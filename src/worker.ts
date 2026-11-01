interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  FOOTBALL_DATA_API_KEY?: string;
}

const FOOTBALL_API_BASE = "https://api.football-data.org/v4/";
const TIMEOUT_MS = 12_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleFootballRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return json(405, { error: "Method not allowed. Use GET." });
  }

  const apiKey = env.FOOTBALL_DATA_API_KEY?.trim();
  if (!apiKey) {
    return json(503, { error: "Football API key is not configured in Cloudflare yet." });
  }

  const requestUrl = new URL(request.url);
  const path = requestUrl.searchParams.get("path");
  if (!path) {
    return json(400, { error: "Missing 'path' query parameter." });
  }

  // Accept only football-data.org v4 endpoint paths used by this website.
  if (
    !/^[a-zA-Z0-9/?=&_-]+$/.test(path) ||
    path.startsWith("/") ||
    path.includes("..")
  ) {
    return json(400, { error: "Invalid football data path." });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(new URL(path, FOOTBALL_API_BASE), {
      headers: { "X-Auth-Token": apiKey },
      signal: controller.signal,
    });

    if (upstream.status === 429) {
      return json(429, { error: "Football data rate limit reached. Please try again shortly." });
    }

    if (!upstream.ok) {
      return json(upstream.status, {
        error: `Football data provider returned HTTP ${upstream.status}. Check the API key and plan.`,
      });
    }

    const data: unknown = await upstream.json();
    return json(200, { data });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return json(504, { error: "Football data request timed out." });
    }
    return json(502, { error: "Football data service is temporarily unavailable." });
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/football") {
      return handleFootballRequest(request, env);
    }

    // All normal website pages and files continue to be served from dist/.
    return env.ASSETS.fetch(request);
  },
};
