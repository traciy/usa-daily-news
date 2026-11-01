// Football-data.org proxy edge function.
//
// The browser never sees the API key — it calls this function, which
// forwards the request to football-data.org with the secret token from
// the edge function environment.
//
// Route: GET /functions/v1/football-data?path=<endpoint>
//
// The `path` query param is appended to https://api.football-data.org/v4/
// e.g. path=matches  ->  https://api.football-data.org/v4/matches
//      path=competitions/PL/matches?status=LIVE
//
// Responses:
//   200 { data: <football-data.org JSON> }
//   429 { error: "Rate limit reached. Try again in a minute." }
//   502 { error: "Football data service is temporarily unavailable." }
//   400 { error: "Missing 'path' query parameter." }
//   503 { error: "Football API key not configured." }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BASE = "https://api.football-data.org/v4/";
const TIMEOUT_MS = 12_000;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed. Use GET." });
  }

  const apiKey = Deno.env.get("FOOTBALL_DATA_API_KEY");
  if (!apiKey || apiKey.trim().length === 0) {
    return json(503, { error: "Football API key not configured on the server." });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path) {
    return json(400, { error: "Missing 'path' query parameter." });
  }

  // Prevent path traversal — only allow alphanumerics, slashes, ?, =, &, -, _
  const safePath = path.replace(/[^a-zA-Z0-9/?=&_-]/g, "");
  if (safePath !== path) {
    return json(400, { error: "Invalid path." });
  }

  const target = `${BASE}${path}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(target, {
      headers: { "X-Auth-Token": apiKey.trim() },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 429) {
      return json(429, { error: "Rate limit reached. Try again in a minute." });
    }

    if (!res.ok) {
      return json(res.status, { error: "Football data service is temporarily unavailable." });
    }

    const data = await res.json();
    return json(200, { data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("aborted")) {
      return json(504, { error: "Football data request timed out." });
    }
    return json(502, { error: "Football data service is temporarily unavailable." });
  }
});
