interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  // Add these as Cloudflare Worker runtime variables. The anon key is public,
  // read-only site access; never use a service-role key here.
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

const SITE_URL = "https://usa-daily-news.info-luwigang254.workers.dev";

interface SeoArticle {
  id: number; title: string; content: string; category: string;
  image_url: string | null; seo_description: string | null;
  created_at: string; source_url: string | null;
}
function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}
function renderArticleMarkdown(markdown: string): string {
  const inline = (value: string) => htmlEscape(value)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return markdown.replace(/\r\n/g, "\n").split(/\n{2,}/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      return "<h" + level + ">" + inline(heading[2]) + "</h" + level + ">";
    }
    const lines = trimmed.split("\n");
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      return "<ul>" + lines.map((line) => "<li>" + inline(line.replace(/^[-*]\s+/, "")) + "</li>").join("") + "</ul>";
    }
    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      return "<ol>" + lines.map((line) => "<li>" + inline(line.replace(/^\d+\.\s+/, "")) + "</li>").join("") + "</ol>";
    }
    return "<p>" + inline(lines.join(" ")) + "</p>";
  }).join("\n");
}
function injectArticleSeo(documentHtml: string, article: SeoArticle): string {
  const canonical = SITE_URL + "/article/" + article.id;
  const description = (article.seo_description || article.content.replace(/[#*_>\[\]()]/g, " ").replace(/\s+/g, " ").trim()).slice(0, 155);
  const image = article.image_url && /^https?:\/\//i.test(article.image_url) ? article.image_url : SITE_URL + "/og-default.png";
  const published = new Date(article.created_at);
  const publishedIso = Number.isNaN(published.getTime()) ? "" : published.toISOString();
  const schema = {
    "@context": "https://schema.org", "@type": "NewsArticle",
    headline: article.title, description, image: [image],
    datePublished: publishedIso || article.created_at,
    dateModified: publishedIso || article.created_at,
    inLanguage: "en-US", isAccessibleForFree: true,
    author: { "@type": "Organization", name: "USA Daily News", url: SITE_URL },
    publisher: { "@type": "Organization", name: "USA Daily News", logo: { "@type": "ImageObject", url: SITE_URL + "/logo.png" } },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    articleSection: article.category, url: canonical,
  };
  const schemaJson = JSON.stringify(schema).replace(/</g, "\\u003c");
  let html = documentHtml
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\b[^>]*\bname=["']description["'][^>]*>/i, "")
    .replace(/<meta\b[^>]*\bname=["']twitter:(?:card|title|description|image)["'][^>]*>/gi, "")
    .replace(/<meta\b[^>]*\bproperty=["'](?:og:title|og:description|og:type|og:url|og:image|article:published_time|article:section)["'][^>]*>/gi, "")
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i, "");
  const tags = [
    "<title>" + htmlEscape(article.title) + " | USA Daily News</title>",
    '<meta name="description" content="' + htmlEscape(description) + '">',
    '<link rel="canonical" href="' + htmlEscape(canonical) + '">',
    '<meta property="og:type" content="article">',
    '<meta property="og:title" content="' + htmlEscape(article.title) + '">',
    '<meta property="og:description" content="' + htmlEscape(description) + '">',
    '<meta property="og:url" content="' + htmlEscape(canonical) + '">',
    '<meta property="og:image" content="' + htmlEscape(image) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + htmlEscape(article.title) + '">',
    '<meta name="twitter:description" content="' + htmlEscape(description) + '">',
    '<meta name="twitter:image" content="' + htmlEscape(image) + '">',
    publishedIso ? '<meta property="article:published_time" content="' + publishedIso + '">' : "",
    '<script type="application/ld+json">' + schemaJson + "</script>",
  ].join("\n");
  const body = '<main id="seo-article"><article><header><p>' + htmlEscape(article.category) +
    "</p><h1>" + htmlEscape(article.title) + "</h1><p>" + htmlEscape(description) +
    '</p><time datetime="' + htmlEscape(article.created_at) + '">' + htmlEscape(publishedIso || article.created_at) +
    "</time></header>" + (article.image_url && /^https?:\/\//i.test(article.image_url)
      ? '<figure><img src="' + htmlEscape(article.image_url) + '" alt="' + htmlEscape(article.title) + '" width="1600" height="900"></figure>' : "") +
    "<div>" + renderArticleMarkdown(article.content || "") + "</div>" +
    (article.source_url && (article.source_url.startsWith("https://") || article.source_url.startsWith("http://"))
      ? '<p class="seo-source"><a href="' + htmlEscape(article.source_url) + '" target="_blank" rel="noopener noreferrer">Read the original source report</a></p>'
      : "") +
    "</article></main>";
  html = html.replace("</head>", tags + "\n</head>");
  return html.replace('<div id="root"></div>', '<div id="root">' + body + "</div>");
}
async function handleArticlePage(request: Request, env: Env, articleId: string): Promise<Response> {
  const fallback = () => env.ASSETS.fetch(new Request(new URL("/", request.url), { method: "GET", headers: request.headers }));
  const notFound = async (): Promise<Response> => {
    const assetResponse = await fallback();
    if (!assetResponse.ok) {
      return new Response("Article not found.", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
      });
    }
    let html = await assetResponse.text();
    html = html
      .replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, "<title>Article not found | USA Daily News</title>")
      .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i, "")
      .replace("</head>", '<meta name="robots" content="noindex,follow"><meta name="description" content="The requested article could not be found."></head>');
    return new Response(html, {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  };
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return fallback();
  try {
    const endpoint = new URL(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/articles");
    endpoint.searchParams.set("select", "id,title,content,category,image_url,seo_description,created_at,source_url");
    endpoint.searchParams.set("id", "eq." + articleId);
    endpoint.searchParams.set("limit", "1");
    const response = await fetch(endpoint.toString(), {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + env.SUPABASE_ANON_KEY, Accept: "application/json" },
      cf: { cacheTtl: 60, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
    if (!response.ok) {
      if (response.status === 404) return notFound();
      return fallback();
    }
    const articles = await response.json() as SeoArticle[];
    const article = articles[0];
    if (!article) return notFound();
    const assetResponse = await fallback();
    if (!assetResponse.ok) return assetResponse;
    const documentHtml = await assetResponse.text();
    if (!documentHtml.includes('<div id="root"></div>')) return new Response(documentHtml, { status: assetResponse.status, headers: assetResponse.headers });
    return new Response(injectArticleSeo(documentHtml, article), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=60", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return fallback();
  }
}


function xmlEscape(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  })[char] ?? char);
}

async function handleSitemap(env: Env): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    // Keep the existing static sitemap available until runtime variables are set.
    return env.ASSETS.fetch(new Request(`${SITE_URL}/sitemap.xml`));
  }

  const baseUrl = env.SUPABASE_URL.replace(/\/$/, "");
  const rows: Array<{ id: number; created_at: string }> = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const endpoint = new URL(`${baseUrl}/rest/v1/articles`);
    endpoint.searchParams.set("select", "id,created_at");
    endpoint.searchParams.set("order", "created_at.desc");
    endpoint.searchParams.set("limit", String(pageSize));
    endpoint.searchParams.set("offset", String(offset));

    const response = await fetch(endpoint.toString(), {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        Accept: "application/json",
      },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });

    if (!response.ok) {
      return new Response("The article sitemap is temporarily unavailable.", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    const batch = await response.json() as Array<{ id: number; created_at: string }>;
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  const articleUrls = rows.map((article) => {
    const lastmod = new Date(article.created_at);
    const lastmodTag = Number.isNaN(lastmod.getTime())
      ? ""
      : `<lastmod>${lastmod.toISOString()}</lastmod>`;
    return `<url><loc>${xmlEscape(`${SITE_URL}/article/${article.id}`)}</loc>${lastmodTag}</url>`;
  }).join("");

  const staticUrls = ["/", "/football", "/weather"]
    .map((path) => `<url><loc>${SITE_URL}${path}</loc></url>`)
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticUrls}${articleUrls}</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
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
    competition: { name: league.name, code },
    homeTeam: {
      name: home?.team?.displayName ?? home?.team?.name ?? "TBD",
      tla: home?.team?.abbreviation ?? "???",
    },
    awayTeam: {
      name: away?.team?.displayName ?? away?.team?.name ?? "TBD",
      tla: away?.team?.abbreviation ?? "???",
    },
    score: {
      fullTime: {
        home: home?.score != null && home.score !== "" ? Number(home.score) : null,
        away: away?.score != null && away.score !== "" ? Number(away.score) : null,
      },
    },
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
    if (url.pathname === "/sitemap.xml") {
      return handleSitemap(env);
    }
    const articleMatch = url.pathname.match(/^\/article\/(\d+)\/?$/);
    if (articleMatch && request.method === "GET") {
      return handleArticlePage(request, env, articleMatch[1]);
    }
    return env.ASSETS.fetch(request);
  },
};
