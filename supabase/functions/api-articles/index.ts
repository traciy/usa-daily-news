// Public ingest endpoint for USA Daily News — usable from n8n / Zapier / curl.
//
// URL:  https://<project>.supabase.co/functions/v1/api-articles
//
// Auth: send `Authorization: Bearer <INGEST_TOKEN>` (INGEST_TOKEN is a secret).
// Body: a single article object OR an array of article objects. Each object:
//   {
//     "title":           string (required),
//     "content":         string (required, markdown ok),
//     "category":        string (required, e.g. "Politics"),
//     "source_url":      string (optional),
//     "image_url":       string (optional),
//     "seo_description": string (optional)
//   }
//
// Responses:
//   201 { success: true, inserted: N, articles: [...] }
//   400 { error: "...", rejected: [...] }      — validation failure (with per-item details)
//   401 { error: "Unauthorized." }
//   405 { error: "Method not allowed. Use POST." }
//   500 { error: "..." }
//
// The service role key bypasses RLS so the public anon key stays read-only.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RawArticle {
  title?: unknown;
  content?: unknown;
  category?: unknown;
  source_url?: unknown;
  image_url?: unknown;
  seo_description?: unknown;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function optionalString(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

function isSafeUrl(value: string, allowHttp = false): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || (allowHttp && url.protocol === "http:")) &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Constant-time-ish string comparison to avoid trivial timing leaks. */
function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < b.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function validateItem(raw: unknown): { ok: true; row: Record<string, unknown> } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "Each article must be a JSON object." };
  }
  const a = raw as RawArticle;
  if (!isNonEmptyString(a.title)) {
    return { ok: false, reason: "Field 'title' is required and must be a non-empty string." };
  }
  if (!isNonEmptyString(a.content)) {
    return { ok: false, reason: "Field 'content' is required and must be a non-empty string." };
  }
  if (!isNonEmptyString(a.category)) {
    return { ok: false, reason: "Field 'category' is required and must be a non-empty string." };
  }

  const title = a.title.trim();
  const content = a.content.trim();
  const requestedCategory = a.category.trim();
  const allowedCategories = ["Politics", "Tech", "Economy", "Culture", "Sports"];
  const category = allowedCategories.find((item) => item.toLowerCase() === requestedCategory.toLowerCase());
  const sourceUrl = optionalString(a.source_url);
  const imageUrl = optionalString(a.image_url);
  const seoDescription = optionalString(a.seo_description);

  if (title.length > 110) return { ok: false, reason: "Headline must be 110 characters or fewer." };
  if (content.length > 20000) return { ok: false, reason: "Article content exceeds the 20,000-character limit." };
  if (!category) return { ok: false, reason: "Category must be Politics, Tech, Economy, Culture, or Sports." };
  if (sourceUrl && !isSafeUrl(sourceUrl, true)) return { ok: false, reason: "Source URL must be a valid HTTP(S) URL." };
  if (imageUrl && !isSafeUrl(imageUrl)) return { ok: false, reason: "Article images must use a valid HTTPS URL." };
  if (seoDescription && seoDescription.length > 180) return { ok: false, reason: "SEO description must be 180 characters or fewer." };

  return {
    ok: true,
    row: {
      title,
      content,
      category,
      source_url: sourceUrl,
      image_url: imageUrl,
      seo_description: seoDescription,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return json(405, { error: "Method not allowed. Use GET or POST." });
    }

    // --- Authenticate via shared bearer token ---
    // The expected token is "Brian" (the publisher's chosen shared secret).
    // INGEST_TOKEN is accepted as an override if it is set to a non-empty value.
    const envToken = Deno.env.get("INGEST_TOKEN")?.trim();
    const acceptable = envToken && envToken.length > 0 ? [envToken, "Brian"] : ["Brian"];

    const authHeader = req.headers.get("Authorization") ?? "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const presented = match ? match[1].trim() : "";

    const authorized = acceptable.some((t) => presented.length === t.length && tokensMatch(presented, t));
    if (!presented || !authorized) {
      return json(401, { error: "Unauthorized." });
    }

    if (req.method === "GET") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Server misconfigured." });
      const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const missingImages = new URL(req.url).searchParams.get("missing_images") === "true";
      const query = missingImages
        ? supabase.from("articles").select("id, title, source_url").is("image_url", null).not("source_url", "is", null).order("created_at", { ascending: false }).limit(100)
        : supabase.from("articles").select("title, source_url").order("created_at", { ascending: false }).limit(1000);
      const { data, error } = await query;
      if (error) return json(500, { error: "Published article lookup failed.", details: error.message });
      return json(200, { success: true, articles: data || [] });
    }
    // --- Parse body ---
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body." });
    }

    // Accept a single object or an array of objects.
    if (body && typeof body === "object" && !Array.isArray(body) && Array.isArray((body as { image_updates?: unknown }).image_updates)) {
      const updates = (body as { image_updates: unknown[] }).image_updates;
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Server misconfigured." });
      const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      let updated = 0;
      const rejected: { index: number; reason: string }[] = [];
      for (const [index, item] of updates.entries()) {
        if (!item || typeof item !== "object") { rejected.push({ index, reason: "Invalid image update." }); continue; }
        const update = item as { id?: unknown; image_url?: unknown };
        const id = Number(update.id);
        const imageUrl = typeof update.image_url === "string" ? update.image_url.trim() : "";
        let validUrl = false;
        try { const parsed = new URL(imageUrl); validUrl = parsed.protocol === "https:" && !parsed.username && !parsed.password; } catch { /* invalid URL */ }
        if (!Number.isSafeInteger(id) || id <= 0 || !validUrl) { rejected.push({ index, reason: "A valid article ID and HTTP(S) image URL are required." }); continue; }
        const { data, error } = await supabase.from("articles").update({ image_url: imageUrl }).eq("id", id).is("image_url", null).select("id");
        if (error) { rejected.push({ index, reason: error.message }); continue; }
        if (data?.length) updated += 1;
      }
      return json(200, { success: true, updated, rejected });
    }
    const items: unknown[] = Array.isArray(body) ? body : [body];
    if (items.length === 0) {
      return json(400, { error: "Body must contain at least one article." });
    }

    const rows: Record<string, unknown>[] = [];
    const rejected: { index: number; reason: string }[] = [];
    items.forEach((item, i) => {
      const result = validateItem(item);
      if (result.ok) {
        rows.push(result.row);
      } else {
        rejected.push({ index: i, reason: result.reason });
      }
    });

    if (rows.length === 0) {
      return json(400, { error: "No valid articles to insert.", rejected });
    }

    // --- Write via service role key (bypasses RLS) ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Server misconfigured: missing Supabase credentials." });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("articles")
      .insert(rows)
      .select("id, title, category, created_at");

    if (error) {
      return json(500, { error: "Database insert failed.", details: error.message });
    }

    return json(201, {
      success: true,
      inserted: Array.isArray(data) ? data.length : 0,
      articles: data,
      rejected,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json(500, { error: "Internal server error.", details: message });
  }
});
