interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const TIMEOUT_MS = 12_000;

const LEAGUES: Record<string, { slug: string; name: string }> = {
  PL: { slug: "eng.1", name: "Premier League" },
  PD: { slug: "esp.1", name: "La Liga" },
  BL1: { slug: "ger.1", name: "Bundesliga" },
  SA: { slug: "ita.1", name: "Serie A" },
  FL1: { slug: "fra.1", name: "Ligue 1" },
  CL: { slug: "uefa.champions", name: "UEFA Champions League" },
};

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

function monthKeysInWindow(): string[] {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);
  from.setUTCDate(from.getUTCDate() - 7);
  to.setUTCDate(to.getUTCDate() + 7);

  const months = new Set<string>();
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));

  while (cursor <= end) {
    months.add(`${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return [...months];
}

function mapEspnEvent(event: any, league: { name: string }, code: string) {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((team: any) => team.homeAway === "home");
  const away = competitors.find((team: any) => team.homeAway === "away");
  const state = competition?.status?.type?.state ?? event.status?.type?.state ?? "pre";
  const detail = competition?.status?.type?.detail ?? event.status?.type?.detail ?? "";
  const displayClock = competition?.status?.displayClock ?? event.status?.displayClock ?? "";
  const parsedMinute = Number.parseInt(displayClock, 10);

  let status = "SCHEDULED";
  if (state === "in") {
    status = /half.?time|halftime/i.test(detail) ? "PAUSED" : "IN_PLAY";
  } else if (state === "post") {
    status = "FINISHED";
  } else if (state === "pre") {
    status = "TIMED";
  }

  return {
    id: Number(event.id),
    competition: league.name,
    competitionCode: code,
    homeTeam: home?.team?.displayName ?? home?.team?.name ?? "TBD",
    homeTla: home?.team?.abbreviation ?? "???",
    awayTeam: away?.team?.displayName ?? away?.team?.name ?? "TBD",
    awayTla: away?.team?.abbreviation ?? "???",
    homeScore: home?.score != null && home.score !== "" ? Number(home.score) : null,
    awayScore: away?.score != null && away.score !== "" ? Number(away.score) : null,
    minute: Number.isFinite(parsedMinute) ? parsedMinute : null,
    status,
    utcDate: event.date ?? competition?.date ?? new Date().toISOString(),
  };
}

async function fetchLeagueMatches(code: string): Promise<any[]> {
  const league = LEAGUES[code];
  if (!league) return [];

  const months = monthKeysInWindow();
  const responses = await Promise.all(months.map(async (month) => {
    const url = new URL(`${ESPN_BASE}/${league.slug}/scoreboard`);
    // ESPN currently rejects date ranges. A YYYYMM month query is supported.
    url.searchParams.set("dates", month);
    url.searchParams.set("limit", "100");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const upstream = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
        cf: { cacheTtl: 300, cacheEverything: true },
      } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });

      if (!upstream.ok) {
        throw new Error(`ESPN returned HTTP ${upstream.status} for ${league.name} (${month}).`);
      }

      const data = await upstream.json() as { events?: any[] };
      return data.events ?? [];
    } finally {
      clearTimeout(timer);
    }
  }));

  const unique = new Map<string, any>();
  for (const event of responses.flat()) unique.set(String(event.id), event);
  const from = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const to = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return [...unique.values()]
    .filter((event) => {
      const kickoff = new Date(event.date).getTime();
      return Number.isFinite(kickoff) && kickoff >= from && kickoff <= to;
    })
    .map((event) => mapEspnEvent(event, league, code));
}

async function handleFootballRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "GET") {
    return json(405, { error: "Method not allowed. Use GET." });
  }

  const requestUrl = new URL(request.url);
  const path = requestUrl.searchParams.get("path");
  if (!path) {
    return json(400, { error: "Missing 'path' query parameter." });
  }

  if (path === "competitions") {
    const competitions = Object.entries(LEAGUES).map(([code, league]) => ({
      id: code,
      name: league.name,
      code,
    }));
    return json(200, { data: { competitions } });
  }

  const matchPath = path.match(/^(?:competitions\/([A-Z0-9]+)\/)?matches(?:\?status=(LIVE|SCHEDULED|TIMED|FINISHED))?$/);
  if (!matchPath) {
    return json(400, { error: "Unsupported football data request." });
  }

  const requestedCode = matchPath[1];
  const statusFilter = matchPath[2];
  if (requestedCode && !LEAGUES[requestedCode]) {
    return json(400, { error: "Competition is not supported." });
  }

  const codes = requestedCode ? [requestedCode] : Object.keys(LEAGUES);
  try {
    const leagueResults = await Promise.all(codes.map((code) => fetchLeagueMatches(code)));
    let matches = leagueResults.flat();

    if (statusFilter === "LIVE") {
      matches = matches.filter((match) => match.status === "IN_PLAY" || match.status === "PAUSED");
    } else if (statusFilter === "SCHEDULED" || statusFilter === "TIMED") {
      matches = matches.filter((match) => match.status === "SCHEDULED" || match.status === "TIMED");
    } else if (statusFilter === "FINISHED") {
      matches = matches.filter((match) => match.status === "FINISHED");
    }

    matches.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
    return json(200, { data: { matches } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Football data service is temporarily unavailable.";
    return json(502, { error: message });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/football") {
      return handleFootballRequest(request);
    }
    return env.ASSETS.fetch(request);
  },
};
