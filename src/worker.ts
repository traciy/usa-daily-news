interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  // Add these as Cloudflare Worker runtime variables. The anon key is public,
  // read-only site access; never use a service-role key here.
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  GH_DISPATCH_TOKEN?: string;
}

const SITE_URL = "https://usadailynews.space";

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
  const image = article.image_url && /^https?:\/\//i.test(article.image_url) ? article.image_url : SITE_URL + "/og-default.svg";
  const published = new Date(article.created_at);
  const publishedIso = Number.isNaN(published.getTime()) ? "" : published.toISOString();
  const schema = {
    "@context": "https://schema.org", "@type": "NewsArticle",
    headline: article.title, description, image: [image],\n    articleBody: article.content.replace(/[#*_>]/g, " ").replace(/\\s+/g, " ").trim(),\n    citation: article.source_url && /^https?:\\/\\//i.test(article.source_url) ? article.source_url : undefined,
    datePublished: publishedIso || article.created_at,
    dateModified: publishedIso || article.created_at,
    inLanguage: "en-US", isAccessibleForFree: true,
    author: { "@type": "Organization", name: "USA Daily News", url: SITE_URL },
    publisher: { "@type": "Organization", name: "USA Daily News", logo: { "@type": "ImageObject", url: SITE_URL + "/logo.svg" } },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    articleSection: article.category, keywords: [article.category, "USA Daily News"], url: canonical,
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

function renderHomepage(articles: SeoArticle[]): string {
  const validArticles = articles.filter((article) =>
    Number.isFinite(Number(article.id)) && article.title && article.category
  );
  if (validArticles.length === 0) return "";
  const cards = validArticles.map((article, index) => {
    const title = htmlEscape(article.title);
    const category = htmlEscape(article.category);
    const description = htmlEscape(article.seo_description || "");
    const date = new Date(article.created_at);
    const dateTime = Number.isNaN(date.getTime()) ? "" : date.toISOString();
    const image = article.image_url && /^https?:\/\//i.test(article.image_url)
      ? '<img src="' + htmlEscape(article.image_url) + '" alt="' + title + '" width="1200" height="675" ' +
        (index === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"') +
        ' decoding="async" style="display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover">'
      : "";
    return '<article class="seo-home-card"><a href="/article/' + Number(article.id) + '">' +
      image + '<p>' + category + '</p><h2>' + title + '</h2>' +
      (description ? '<p>' + description + '</p>' : "") +
      (dateTime ? '<time datetime="' + dateTime + '">' + date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) + '</time>' : "") +
      '</a></article>';
  }).join("");
  return '<main id="seo-home" class="mx-auto max-w-6xl px-4 py-8">' +
    '<header><h1>Latest US News, Politics, Technology, Economy &amp; Culture</h1>' +
    '<p>Read the latest news and developing stories from across the United States.</p></header>' +
    '<nav aria-label="News sections"><a href="/">Latest News</a> · ' +
    '<a href="/politics">Politics</a> · <a href="/tech">Technology</a> · ' +
    '<a href="/economy">Economy</a> · <a href="/culture">Culture</a> · ' +
    '<a href="/football">Sports</a> · <a href="/weather">Weather</a></nav>' +
    '<section aria-labelledby="seo-latest-heading"><h2 id="seo-latest-heading">Latest Stories</h2>' +
    '<div class="seo-home-stories">' + cards + '</div></section></main>';
}


interface StaticSeoPage {
  title: string;
  description: string;
  heading: string;
  paragraphs: string[];
}
const STATIC_SEO_PAGES: Record<string, StaticSeoPage> = {
  "/about": {
    title: "About USA Daily News",
    description: "Learn about USA Daily News, our coverage, how we use sources and automated tools, and how to contact us.",
    heading: "About USA Daily News",
    paragraphs: [
      "USA Daily News is a digital publication covering news and developing stories across the United States and around the world, including politics, business, technology, culture, weather and sports.",
      "Digital tools and AI-assisted processes may help discover, organize and prepare news summaries. Articles may summarize reporting published by other outlets. Where source information is available, we identify and link to the original report.",
      "We do not claim that every item is original, independent reporting produced by an on-the-ground newsroom. Contact us if you identify an error or missing attribution."
    ]
  },
  "/editorial-policy": {
    title: "Editorial Policy | USA Daily News",
    description: "USA Daily News standards for sourcing, AI-assisted content, accuracy, attribution and updates.",
    heading: "Editorial Policy",
    paragraphs: [
      "USA Daily News aims to publish clear, useful news summaries and make the source of reported information as transparent as possible.",
      "Automated systems and AI-assisted tools may be used to identify, organize, summarize and prepare content. These tools can make mistakes. Not every detail is independently verified by a human editor.",
      "When articles summarize another publisher's reporting, we aim to identify and link to that source. Developing stories may change as new information becomes available."
    ]
  },
  "/corrections": {
    title: "Corrections Policy | USA Daily News",
    description: "How to report an error and how USA Daily News reviews and corrects inaccurate or incomplete information.",
    heading: "Corrections Policy",
    paragraphs: [
      "If you believe an article contains a factual error, misleading wording or incorrect attribution, email info.luwigang254@gmail.com.",
      "Include the article URL, the exact statement you believe is incorrect, what you believe the correct information should be, and links to reliable supporting sources or documents.",
      "We assess correction reports against available evidence. If a material error is confirmed, we may correct the article, clarify wording, update attribution or remove content when appropriate."
    ]
  },
  "/privacy-policy": {
    title: "Privacy Policy | USA Daily News",
    description: "How USA Daily News handles information when you visit the website, use analytics or contact us.",
    heading: "Privacy Policy",
    paragraphs: [
      "USA Daily News uses Google Analytics to understand visits and page usage. Analytics technologies may collect pages viewed, device and browser details, interaction data and approximate location derived from network information.",
      "The website is delivered using Cloudflare and stores article content using Supabase. These service providers may process technical information needed to deliver, secure and operate the website.",
      "If you email us, we receive the information you choose to include and use it to respond, review news tips or assess correction requests. External websites linked from our articles have their own privacy practices."
    ]
  },
  "/contact": {
    title: "Contact USA Daily News",
    description: "Contact USA Daily News with news tips, corrections, feedback and general enquiries.",
    heading: "Contact USA Daily News",
    paragraphs: [
      "Have a question, news tip, correction or feedback about something published on this site? Email info.luwigang254@gmail.com.",
      "For a correction request, include the article URL, the specific detail you believe is inaccurate and a link or document that can help us review it."
    ]
  },
  "/politics": {
    title: "US Politics News | USA Daily News",
    description: "US politics news, government coverage, policy developments and election updates from USA Daily News.",
    heading: "US Politics News",
    paragraphs: ["Follow US politics, government decisions, public policy and election developments with news summaries and links to source reporting."]
  },
  "/tech": {
    title: "Technology News | USA Daily News",
    description: "Technology news, AI developments, innovation and digital industry coverage from USA Daily News.",
    heading: "Technology News",
    paragraphs: ["Explore technology coverage including artificial intelligence, innovation, digital platforms and developments across the technology industry."]
  },
  "/economy": {
    title: "Business & Economy News | USA Daily News",
    description: "Business and economy news, markets, jobs, finance and economic policy coverage from USA Daily News.",
    heading: "Business & Economy News",
    paragraphs: ["Follow business and economic developments, markets, employment, finance and policy with source-attributed news summaries."]
  },
  "/culture": {
    title: "Culture & Entertainment News | USA Daily News",
    description: "Culture news, entertainment, arts, society and lifestyle coverage from USA Daily News.",
    heading: "Culture News",
    paragraphs: ["Read coverage of entertainment, arts, media, society and cultural developments in the United States and around the world."]
  },
  "/football": {
    title: "Football & Sports News | USA Daily News",
    description: "Follow football fixtures, scores and sports coverage from USA Daily News.",
    heading: "Football & Sports",
    paragraphs: [
      "Follow football fixtures, live scores and results across major European competitions, alongside sports coverage from USA Daily News.",
      "Match information is supplied by external sports data services and may be delayed or subject to correction."
    ]
  },
  "/weather": {
    title: "Weather News & Forecasts | USA Daily News",
    description: "Weather coverage and forecast information from USA Daily News.",
    heading: "Weather",
    paragraphs: [
      "Explore weather coverage and forecast information on USA Daily News.",
      "Weather conditions can change quickly. Check official local weather services for warnings and decisions that affect safety."
    ]
  }
};

async function handleStaticSeoPage(request: Request, env: Env, path: string): Promise<Response> {
  const page = STATIC_SEO_PAGES[path];
  if (!page) return env.ASSETS.fetch(request);
  const asset = await env.ASSETS.fetch(request);
  if (!asset.ok) return asset;
  let html = await asset.text();
  const canonical = SITE_URL + path;
  const description = htmlEscape(page.description);
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "USA Daily News", url: SITE_URL },
    publisher: { "@type": "NewsMediaOrganization", name: "USA Daily News", url: SITE_URL, logo: { "@type": "ImageObject", url: SITE_URL + "/logo.svg" } }
  }).replace(/</g, "\\u003c");
  const tags = [
    "<title>" + htmlEscape(page.title) + "</title>",
    '<meta name="description" content="' + description + '">',
    '<link rel="canonical" href="' + canonical + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + htmlEscape(page.title) + '">',
    '<meta property="og:description" content="' + description + '">',
    '<meta property="og:url" content="' + canonical + '">',
    '<meta property="og:image" content="' + SITE_URL + '/og-default.svg">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + htmlEscape(page.title) + '">',
    '<meta name="twitter:description" content="' + description + '">',
    '<meta name="twitter:image" content="' + SITE_URL + '/og-default.svg">',
    '<script type="application/ld+json">' + schema + '</script>'
  ].join("\n");
  html = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\b[^>]*\bname=["']description["'][^>]*>/i, "")
    .replace(/<meta\b[^>]*\bproperty=["']og:[^"']+["'][^>]*>/gi, "")
    .replace(/<meta\b[^>]*\bname=["']twitter:[^"']+["'][^>]*>/gi, "")
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i, "")
    .replace("</head>", tags + "\n</head>");
  const body = '<main id="seo-static-content"><article><h1>' + htmlEscape(page.heading) + '</h1>' +
    page.paragraphs.map((paragraph) => "<p>" + htmlEscape(paragraph) + "</p>").join("") +
    '<nav aria-label="News sections"><a href="/">Latest news</a> · <a href="/politics">Politics</a> · <a href="/tech">Technology</a> · <a href="/economy">Economy</a> · <a href="/culture">Culture</a> · <a href="/football">Sports</a> · <a href="/weather">Weather</a></nav><p><a href="/about">About</a> · <a href="/editorial-policy">Editorial policy</a> · <a href="/corrections">Corrections</a> · <a href="/privacy-policy">Privacy</a> · <a href="/contact">Contact</a></p></article></main>';
  html = html.replace('<div id="root"></div>', '<div id="root">' + body + '</div>');
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
      "X-SEO-Page": path
    }
  });
}

async function handleHomePage(request: Request, env: Env): Promise<Response> {
  const fallback = async (reason: string, response?: Response): Promise<Response> => {
    const asset = response ?? await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set("X-Homepage-SEO", reason);
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  };

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return fallback("missing-runtime-env");
  }

  try {
    const endpoint = new URL(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/articles");
    endpoint.searchParams.set("select", "id,title,category,image_url,seo_description,created_at,source_url");
    endpoint.searchParams.set("order", "created_at.desc");
    endpoint.searchParams.set("limit", "24");
    const response = await fetch(endpoint.toString(), {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + env.SUPABASE_ANON_KEY,
        Accept: "application/json",
      },
      cf: { cacheTtl: 60, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });

    if (!response.ok) {
      console.error("Homepage SEO Supabase request failed:", response.status);
      return fallback("supabase-http-" + response.status);
    }

    const articles = await response.json() as SeoArticle[];
    const homepage = renderHomepage(articles);
    if (!homepage) return fallback("no-valid-articles");

    const assetResponse = await env.ASSETS.fetch(request);
    if (!assetResponse.ok) return fallback("assets-http-" + assetResponse.status, assetResponse);

    let html = await assetResponse.text();
    if (!html.includes('<div id="root"></div>')) return fallback("root-placeholder-missing", new Response(html, { status: assetResponse.status, headers: assetResponse.headers }));

    html = html.replace('<div id="root"></div>', '<div id="root">' + homepage + '</div>');
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=60",
        "X-Content-Type-Options": "nosniff",
        "X-Homepage-SEO": "rendered-" + articles.length + "-articles",
      },
    });
  } catch (error) {
    console.error("Homepage SEO rendering failed:", error);
    return fallback("worker-exception");
  }
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

  const staticUrls = ["/", "/politics", "/tech", "/economy", "/culture", "/football", "/weather", "/about", "/contact", "/editorial-policy", "/corrections", "/privacy-policy"]
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


async function handleNewsSitemap(env: Env): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return new Response("News sitemap is temporarily unavailable.", { status: 503 });
  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const endpoint = new URL(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/articles");
    endpoint.searchParams.set("select", "id,title,created_at");
    endpoint.searchParams.set("created_at", "gte." + cutoff);
    endpoint.searchParams.set("order", "created_at.desc");
    endpoint.searchParams.set("limit", "1000");
    const response = await fetch(endpoint.toString(), {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + env.SUPABASE_ANON_KEY, Accept: "application/json" },
      cf: { cacheTtl: 120, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
    if (!response.ok) return new Response("News sitemap could not load recent articles.", { status: 502 });
    const articles = await response.json() as Array<{ id: number; title: string; created_at: string }>;
    const entries = articles.filter((article) => article.id && article.title && Number.isFinite(Date.parse(article.created_at))).map((article) => {
      const date = new Date(article.created_at).toISOString();
      return "<url><loc>" + xmlEscape(SITE_URL + "/article/" + Number(article.id)) + "</loc>" +
        "<news:news><news:publication><news:name>USA Daily News</news:name><news:language>en</news:language></news:publication>" +
        "<news:publication_date>" + date + "</news:publication_date><news:title>" + xmlEscape(article.title) + "</news:title></news:news></url>";
    }).join("");
    const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">' + entries + "</urlset>";
    return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=120, s-maxage=120" } });
  } catch (error) {
    console.error("News sitemap generation failed:", error);
    return new Response("News sitemap is temporarily unavailable.", { status: 502 });
  }
}

function rssCdata(value: string): string {
  return value.replace(/\]\]>/g, "]]]]><![CDATA[>");
}

function rssPlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function handleRssFeed(env: Env): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return new Response("RSS feed is temporarily unavailable.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  try {
    const endpoint = new URL(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/articles");
    endpoint.searchParams.set("select", "id,title,content,category,image_url,seo_description,created_at,source_url");
    endpoint.searchParams.set("order", "created_at.desc");
    endpoint.searchParams.set("limit", "50");

    const response = await fetch(endpoint.toString(), {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + env.SUPABASE_ANON_KEY,
        Accept: "application/json",
      },
      cf: { cacheTtl: 120, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });

    if (!response.ok) {
      console.error("RSS feed Supabase request failed:", response.status);
      return new Response("RSS feed is temporarily unavailable.", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    const articles = await response.json() as SeoArticle[];
    const items = articles.filter((article) => Number.isFinite(Number(article.id)) && article.title).map((article) => {
      const link = SITE_URL + "/article/" + Number(article.id);
      const published = new Date(article.created_at);
      const pubDate = Number.isNaN(published.getTime()) ? "" : "<pubDate>" + published.toUTCString() + "</pubDate>";
      const description = article.seo_description || rssPlainText(article.content || "").slice(0, 500);
      const content = article.content || description;
      const source = article.source_url && /^https?:\/\//i.test(article.source_url)
        ? '<p>Original source: <a href="' + xmlEscape(article.source_url) + '">' + xmlEscape(article.source_url) + "</a></p>"
        : "";
      const image = article.image_url && /^https?:\/\//i.test(article.image_url)
        ? '<p><img src="' + xmlEscape(article.image_url) + '" alt="' + xmlEscape(article.title) + '"></p>'
        : "";
      const htmlContent = image + "<p>" + xmlEscape(description) + "</p><pre>" + xmlEscape(content) + "</pre>" + source;
      return "<item>" +
        "<title>" + xmlEscape(article.title) + "</title>" +
        "<link>" + xmlEscape(link) + "</link>" +
        "<guid isPermaLink=\"true\">" + xmlEscape(link) + "</guid>" +
        pubDate +
        "<category>" + xmlEscape(article.category || "News") + "</category>" +
        "<description><![CDATA[" + rssCdata(description) + "]]></description>" +
        "<content:encoded><![CDATA[" + rssCdata(htmlContent) + "]]></content:encoded>" +
        (article.image_url && /^https?:\/\//i.test(article.image_url)
          ? '<enclosure url="' + xmlEscape(article.image_url) + '" type="image/jpeg"/>'
          : "") +
        "</item>";
    }).join("");

    const updated = articles[0]?.created_at ? new Date(articles[0].created_at).toUTCString() : new Date().toUTCString();
    const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">' +
      "<channel>" +
      "<title>USA Daily News</title>" +
      "<link>" + SITE_URL + "</link>" +
      "<description>Latest US and international news, politics, business, technology, culture and sports from USA Daily News.</description>" +
      "<language>en-us</language>" +
      "<lastBuildDate>" + updated + "</lastBuildDate>" +
      '<atom:link href="' + SITE_URL + '/feed.xml" rel="self" type="application/rss+xml"/>' +
      "<image><url>" + SITE_URL + "/og-default.svg</url><title>USA Daily News</title><link>" + SITE_URL + "</link></image>" +
      items +
      "</channel></rss>";

    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=120, s-maxage=120",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("RSS feed generation failed:", error);
    return new Response("RSS feed is temporarily unavailable.", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
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
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      const clean = new URL(url);
      clean.pathname = clean.pathname.replace(/\/+$/, "");
      return Response.redirect(clean.toString(), 301);
    }
    if (url.pathname === "/sports") {
      const destination = new URL(url);
      destination.pathname = "/football";
      return Response.redirect(destination.toString(), 301);
    }
    if (url.hostname === "usa-daily-news.info-luwigang254.workers.dev" || url.hostname === "www.usadailynews.space") {
      const destination = new URL(url.pathname + url.search, SITE_URL);
      return Response.redirect(destination.toString(), 301);
    }
    if (url.pathname === "/api/football") {
      return handleFootballRequest(request);
    }
    if (url.pathname === "/feed.xml" || url.pathname === "/rss.xml") {
      return handleRssFeed(env);
    }
    if (url.pathname === "/sitemap.xml") {
      return handleSitemap(env);
    }
    if (url.pathname === "/news-sitemap.xml") {
      return handleNewsSitemap(env);
    }
    if (request.method === "GET" && STATIC_SEO_PAGES[url.pathname]) {
      return handleStaticSeoPage(request, env, url.pathname);
    }
    if (url.pathname === "/" && request.method === "GET") {
      return handleHomePage(request, env);
    }
    const articleMatch = url.pathname.match(/^\/article\/(\d+)\/?$/);
    if (articleMatch && request.method === "GET") {
      return handleArticlePage(request, env, articleMatch[1]);
    }
    return env.ASSETS.fetch(request);
  },

  // Cloudflare's scheduler is independent of GitHub Actions cron.
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      if (!env.GH_DISPATCH_TOKEN) {
        console.error("GH_DISPATCH_TOKEN is missing. Add it as a Worker secret to enable scheduled publishing.");
        return;
      }

      const repo = "traciy/usa-daily-news";
      const workflowId = "389035432";
      const headers = {
        Authorization: "Bearer " + env.GH_DISPATCH_TOKEN,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };

      const runsResponse = await fetch(
        "https://api.github.com/repos/" + repo + "/actions/workflows/" + workflowId + "/runs?per_page=10",
        { headers }
      );
      if (!runsResponse.ok) {
        throw new Error("GitHub run check failed: HTTP " + runsResponse.status);
      }
      const runsData = await runsResponse.json() as { workflow_runs?: Array<{ status?: string; id?: number }> };
      const active = (runsData.workflow_runs || []).find((run) =>
        ["queued", "in_progress", "waiting", "pending"].includes(run.status || "")
      );
      if (active) {
        console.log("News automation already active (run " + active.id + "); skipping this tick.");
        return;
      }

      const dispatchResponse = await fetch(
        "https://api.github.com/repos/" + repo + "/actions/workflows/" + workflowId + "/dispatches",
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ ref: "main", inputs: { publish: "true" } }),
        }
      );
      if (!dispatchResponse.ok) {
        throw new Error("GitHub workflow dispatch failed: HTTP " + dispatchResponse.status + " " + await dispatchResponse.text());
      }
      console.log("Cloudflare Cron successfully dispatched the news automation.");
    })());
  },
};
