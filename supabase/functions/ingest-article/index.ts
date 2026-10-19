// Secure article ingestion endpoint for USA Daily News.
//
// POST a JSON body matching the articles schema to add a new article.
// The endpoint is protected by a bearer token (INGEST_TOKEN) that you set
// as an edge function secret. The service role key bypasses RLS so the
// public anon key stays read-only.
//
// Example:
//   curl -X POST https://<project>.supabase.co/functions/v1/ingest-article \
//     -H "Authorization: Bearer <INGEST_TOKEN>" \
//     -H "Content-Type: application/json" \
//     -d '{"title":"...","content":"...","category":"Politics", ...}'
//
// Required env (configured as edge function secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   INGEST_TOKEN  — the shared secret the publisher sends in Authorization

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface IngestPayload {
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Authenticate via shared bearer token ---
    const ingestToken = Deno.env.get("INGEST_TOKEN");
    if (!ingestToken) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: missing ingest token." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const presented = match ? match[1].trim() : "";

    // Constant-time-ish comparison to avoid trivial timing leaks.
    if (!presented || presented.length !== ingestToken.length) {
      return new Response(
        JSON.stringify({ error: "Unauthorized." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let diff = 0;
    for (let i = 0; i < ingestToken.length; i++) {
      diff |= presented.charCodeAt(i) ^ ingestToken.charCodeAt(i);
    }
    if (diff !== 0) {
      return new Response(
        JSON.stringify({ error: "Unauthorized." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Parse + validate body ---
    let body: IngestPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isNonEmptyString(body.title)) {
      return new Response(
        JSON.stringify({ error: "Field 'title' is required and must be a non-empty string." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!isNonEmptyString(body.content)) {
      return new Response(
        JSON.stringify({ error: "Field 'content' is required and must be a non-empty string." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!isNonEmptyString(body.category)) {
      return new Response(
        JSON.stringify({ error: "Field 'category' is required and must be a non-empty string." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const insertRow = {
      title: body.title.trim(),
      content: body.content,
      category: body.category.trim(),
      source_url: optionalString(body.source_url),
      image_url: optionalString(body.image_url),
      seo_description: optionalString(body.seo_description),
    };

    // --- Write via service role key (bypasses RLS) ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: missing Supabase credentials." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("articles")
      .insert(insertRow)
      .select("id, title, category, created_at")
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: "Database insert failed.", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, article: data }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error.", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
