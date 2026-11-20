import { appendFileSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
if (!supabaseUrl || !supabaseKey) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");

const pageSize = 1000;
const timeoutMs = 12000;
const concurrency = 10;
const userAgent = "USA-Daily-News-Source-Link-Audit/1.0 (+https://usadailynews.space/about)";

async function loadArticles() {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const endpoint = new URL(supabaseUrl + "/rest/v1/articles");
    endpoint.searchParams.set("select", "id,title,source_url,created_at");
    endpoint.searchParams.set("order", "id.asc");
    endpoint.searchParams.set("limit", String(pageSize));
    endpoint.searchParams.set("offset", String(offset));
    const response = await fetch(endpoint, {
      headers: { apikey: supabaseKey, Authorization: "Bearer " + supabaseKey, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error("Could not load article records from Supabase: HTTP " + response.status);
    const batch = await response.json();
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function validateUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return "Unsupported URL protocol";
    if (url.username || url.password) return "URL contains credentials";
    if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || isIP(host)) {
      return "URL host is not a public hostname";
    }
    return null;
  } catch {
    return "Invalid URL";
  }
}

async function requestUrl(url, method) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    if (method === "GET") headers.Range = "bytes=0-0";
    const response = await fetch(url, { method, headers, redirect: "follow", signal: controller.signal });
    const result = { status: response.status, finalUrl: response.url || url };
    try { await response.body?.cancel(); } catch { /* response body is intentionally not downloaded */ }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkUrl(url) {
  const invalidReason = validateUrl(url);
  if (invalidReason) return { status: "INVALID", detail: invalidReason, finalUrl: url };
  try {
    const head = await requestUrl(url, "HEAD");
    if ([403, 404, 405, 410, 429, 501].includes(head.status)) {
      const get = await requestUrl(url, "GET");
      if ([404, 410].includes(get.status)) return { status: "BROKEN", detail: "Confirmed HTTP " + get.status, finalUrl: get.finalUrl };
      if (get.status >= 200 && get.status < 400) return { status: "OK", detail: "GET fallback returned HTTP " + get.status, finalUrl: get.finalUrl };
      return { status: "INCONCLUSIVE", detail: "HEAD HTTP " + head.status + "; GET HTTP " + get.status, finalUrl: get.finalUrl };
    }
    if (head.status >= 200 && head.status < 400) return { status: "OK", detail: "HTTP " + head.status, finalUrl: head.finalUrl };
    if ([404, 410].includes(head.status)) return { status: "BROKEN", detail: "HTTP " + head.status, finalUrl: head.finalUrl };
    return { status: "INCONCLUSIVE", detail: "HTTP " + head.status, finalUrl: head.finalUrl };
  } catch (error) {
    return {
      status: "INCONCLUSIVE",
      detail: error?.name === "AbortError" ? "Request timed out" : String(error?.message || error).slice(0, 180),
      finalUrl: url,
    };
  }
}

async function mapLimit(items, limit, mapper) {
  const output = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  }));
  return output;
}

const articles = await loadArticles();
const urlToArticles = new Map();
for (const article of articles) {
  const url = String(article.source_url || "").trim();
  if (!url) continue;
  const collection = urlToArticles.get(url) || [];
  collection.push(article);
  urlToArticles.set(url, collection);
}
const uniqueUrls = [...urlToArticles.keys()];
console.log("Checking " + uniqueUrls.length + " unique source URLs across " + articles.length + " articles...");
const checked = await mapLimit(uniqueUrls, concurrency, async (url, index) => {
  if ((index + 1) % 100 === 0) console.log("Checked " + (index + 1) + " / " + uniqueUrls.length);
  return { url, ...(await checkUrl(url)) };
});
const byUrl = new Map(checked.map((item) => [item.url, item]));
const rows = articles.map((article) => {
  const url = String(article.source_url || "").trim();
  const result = byUrl.get(url);
  return {
    id: article.id,
    title: article.title || "",
    source_url: url,
    status: result?.status || "INVALID",
    detail: result?.detail || "Missing source URL",
    final_url: result?.finalUrl || "",
  };
});
const broken = rows.filter((row) => row.status === "BROKEN" || row.status === "INVALID");
const inconclusive = rows.filter((row) => row.status === "INCONCLUSIVE");
const valid = rows.filter((row) => row.status === "OK");
const csvEscape = (value) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
const csv = [
  ["article_id", "title", "source_url", "status", "detail", "final_url"].join(","),
  ...rows.map((row) => [row.id, row.title, row.source_url, row.status, row.detail, row.final_url].map(csvEscape).join(",")),
].join("\n");
writeFileSync("source-link-audit.csv", csv + "\n");
const report = {
  checked_at: new Date().toISOString(),
  total_articles: articles.length,
  unique_source_urls: uniqueUrls.length,
  valid_article_links: valid.length,
  confirmed_broken_or_invalid_article_links: broken.length,
  inconclusive_article_links: inconclusive.length,
  broken,
  inconclusive,
};
writeFileSync("source-link-audit.json", JSON.stringify(report, null, 2));
const summary = [
  "### USA Daily News source-link audit",
  "",
  "- Articles checked: **" + report.total_articles + "**",
  "- Unique source URLs checked: **" + report.unique_source_urls + "**",
  "- Working links: **" + report.valid_article_links + "**",
  "- Confirmed broken or invalid links: **" + report.confirmed_broken_or_invalid_article_links + "**",
  "- Inconclusive (blocked, rate-limited, timed out, or server error): **" + report.inconclusive_article_links + "**",
  "",
  "A link is marked broken only when an HTTP 404 or 410 response is confirmed. Inconclusive responses are not treated as broken.",
].join("\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, "broken_count=" + broken.length + "\n");
  appendFileSync(process.env.GITHUB_OUTPUT, "inconclusive_count=" + inconclusive.length + "\n");
}
