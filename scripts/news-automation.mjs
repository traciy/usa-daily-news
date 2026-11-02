/**
 * Replaces the uploaded n8n flow:
 * Publisher RSS feeds -> Gemini -> JSON validation -> Supabase Edge Function.
 * Secrets are supplied by GitHub Actions, never stored in this file.
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const ARTICLE_COUNT = positiveInteger(process.env.ARTICLE_COUNT, 10);
const ARTICLE_WORDS = positiveInteger(process.env.ARTICLE_WORDS, 1000);
const PUBLISH_ENABLED = String(process.env.PUBLISH_ENABLED).toLowerCase() === "true";

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required GitHub secret/environment variable: ${name}`);
  }
  return value.trim();
}

async function fetchWithRetry(url, options = {}, label = "request", attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      const body = await response.text();
      const message = `${label} failed (HTTP ${response.status}): ${body.slice(0, 1200)}`;
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
        lastError = new Error(message);
        continue;
      }
      throw new Error(message);
    } catch (error) {
      lastError = error;
      if (attempt < attempts && !(error instanceof Error && /HTTP 4\d\d/.test(error.message) && !/HTTP 429/.test(error.message))) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error(`${label} failed after retries.`);
}

function normalizedUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function parseModelJson(text) {
  const cleaned = String(text ?? "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  let data;
  try {
    data = JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`Gemini did not return valid JSON: ${error.message}`);
  }
  if (!Array.isArray(data)) data = Array.isArray(data?.articles) ? data.articles : [data];
  return data;
}

const RSS_FEEDS = [
  { name: "NPR", url: "https://feeds.npr.org/1001/rss.xml", category: "Politics" },
  { name: "NBC News", url: "https://feeds.nbcnews.com/nbcnews/public/news", category: "Politics" },
  { name: "ABC News", url: "https://abcnews.go.com/abcnews/topstories", category: "Politics" },
  { name: "CBS News", url: "https://www.cbsnews.com/latest/rss/main", category: "Politics" },
  { name: "Politico", url: "https://rss.politico.com/politics-news.xml", category: "Politics" },
  { name: "The Hill", url: "https://thehill.com/feed/", category: "Politics" },
  { name: "Axios", url: "https://api.axios.com/feed/", category: "Politics" },
  { name: "ESPN", url: "https://www.espn.com/espn/rss/news", category: "Sports" },
];

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function cleanFeedText(value = "") {
  return decodeXml(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getXmlTag(block, tagNames) {
  for (const tag of tagNames) {
    const match = block.match(new RegExp("<" + tag + "\\b[^>]*>([\\s\\S]*?)<\\/" + tag + "\\s*>", "i"));
    if (match) return match[1].trim();
  }
  return "";
}

function parseRssFeed(xml, feed) {
  const itemBlocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)];
  return itemBlocks.map((match) => {
    const block = match[2];
    const title = cleanFeedText(getXmlTag(block, ["title"]));
    const description = cleanFeedText(getXmlTag(block, ["description", "summary", "content:encoded", "content"]));
    const content = cleanFeedText(getXmlTag(block, ["content:encoded", "content", "description", "summary"]));
    const rawLink = getXmlTag(block, ["link"]);
    const href = rawLink.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const link = decodeXml(rawLink.replace(/<[^>]+>/g, "").trim() || href || "");
    const rawDate = getXmlTag(block, ["pubDate", "published", "updated", "dc:date"]);
    const image = block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*\burl=["']([^"']+)["']/i)?.[1] || null;
    let publishedAt = null;
    if (rawDate) {
      const parsedDate = Date.parse(cleanFeedText(rawDate));
      if (Number.isFinite(parsedDate)) publishedAt = new Date(parsedDate).toISOString();
    }
    return {
      title, description: description.slice(0, 3000), content: content.slice(0, 5000),
      url: normalizedUrl(link), publishedAt, source: { name: feed.name },
      source_category: feed.category, urlToImage: image ? decodeXml(image) : null,
    };
  }).filter((article) => {
    if (!article.title || !article.url || !/^https?:\/\//i.test(article.url)) return false;
    if (article.publishedAt) return Date.now() - Date.parse(article.publishedAt) <= 48 * 60 * 60 * 1000;
    return true;
  });
}

async function getHeadlines() {
  const results = await Promise.allSettled(RSS_FEEDS.map(async (feed) => {
    const response = await fetchWithRetry(feed.url, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "USA-Daily-News-Bot/1.0 (+https://usa-daily-news.info-luwigang254.workers.dev)",
      },
      signal: AbortSignal.timeout(15000),
    }, feed.name + " RSS feed", 1);
    const xml = await response.text();
    if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error(feed.name + " did not return recognizable RSS/XML.");
    const articles = parseRssFeed(xml, feed).slice(0, 15);
    console.log(feed.name + " RSS: " + articles.length + " recent usable stories.");
    return articles;
  }));

  const articles = [];
  const seen = new Set();
  const failures = [];
  for (const result of results) {
    if (result.status === "rejected") {
      failures.push(result.reason?.message || String(result.reason));
      continue;
    }
    for (const article of result.value) {
      const key = normalizedUrl(article.url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      articles.push(article);
    }
  }
  console.log("RSS collection finished: " + articles.length + " unique stories from " + RSS_FEEDS.length + " feeds; " + failures.length + " feed(s) unavailable.");
  if (failures.length) console.warn("RSS feed warnings:", failures.join(" | "));
  if (articles.length === 0) {
    throw new Error("No usable RSS stories were collected. Feed errors: " + (failures.join(" | ") || "Feeds returned no recent stories."));
  }
  return articles;
}

async function generateArticles(geminiApiKey, sourceArticles) {
  const prompt = `You are the Chief Editor of USA Daily News. Look at the raw news articles provided below. Select the ${ARTICLE_COUNT} top most impactful stories. For each story:
1. Rewrite the headline clearly and accurately; do not exaggerate the facts.
2. Write an original report of approximately ${ARTICLE_WORDS} words using only facts supported by the supplied source material. Do not pad the article or invent quotes, statistics, dates, causes, motives, or background details. If the source material is too thin to support a useful report, return fewer articles rather than guessing.
3. Categorize it (Politics, Tech, Economy, Culture, or Sports).
4. Generate a clear SEO description of about 150 characters.
5. Keep the article neutral, specific, readable, and useful. Attribute information to the supplied source where appropriate.

Output the result strictly as a clean JSON array matching these keys: title, content, category, source_url, image_url, seo_description.

Here is the raw news data:
${JSON.stringify(sourceArticles.map((a) => ({
  title: a.title,
  description: a.description,
  content: a.content,
  source_name: a.source?.name,
  source_category: a.source_category,
  author: a.author,
  publishedAt: a.publishedAt,
  url: a.url,
  urlToImage: a.urlToImage,
})))}`;

  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 60000,
        },
      }),
    },
    "Gemini article generation",
  );

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text || "").join("").trim();
  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(`Gemini returned no text.${blockReason ? ` Block reason: ${blockReason}` : " Check your API key, model, or API quota."}`);
  }

  const parsed = parseModelJson(text);
  if (parsed.length === 0) {   console.error("Gemini diagnostic:", JSON.stringify({     model: MODEL,     finishReason: data?.candidates?.[0]?.finishReason,     promptFeedback: data?.promptFeedback,     candidateCount: data?.candidates?.length ?? 0,     responseTextLength: text.length,     responsePreview: text.slice(0, 500)   }, null, 2));    throw new Error("Gemini returned an empty article list. See diagnostic above."); }
  return parsed;
}

function validateAndNormalize(generated, sourceArticles) {
  const sourceByUrl = new Map(sourceArticles.map((article) => [normalizedUrl(article.url), article]));
  const allowedCategories = new Set(["Politics", "Tech", "Economy", "Culture", "Sports"]);
  const seenSources = new Set();
  const validated = [];

  for (const article of generated) {
    if (!article || typeof article !== "object") continue;
    const sourceKey = normalizedUrl(article.source_url);
    const original = sourceByUrl.get(sourceKey);
    if (!original) {
      console.warn(`Skipping an article because its source_url did not match a URL collected from RSS feeds.`);
      continue;
    }
    if (seenSources.has(sourceKey)) {
      console.warn(`Skipping a duplicate source article: ${original.title}`);
      continue;
    }

    const title = typeof article.title === "string" ? article.title.trim() : "";
    const content = typeof article.content === "string" ? article.content.trim() : "";
    const seoDescription = typeof article.seo_description === "string" ? article.seo_description.trim() : "";
    const requestedCategory = typeof article.category === "string" ? article.category.trim() : "";
    const category = [...allowedCategories].find((allowed) => allowed.toLowerCase() === requestedCategory.toLowerCase());

    if (!title || !content || !seoDescription || !category) {
      console.warn(`Skipping an article with missing fields or invalid category. Source: ${original.title}`);
      continue;
    }

    seenSources.add(sourceKey);
    validated.push({
      title,
      content,
      category,
      source_url: original.url,
      image_url: original.urlToImage || null,
      seo_description: seoDescription.slice(0, 180),
    });
    if (validated.length >= ARTICLE_COUNT) break;
  }

  if (validated.length === 0) {
    throw new Error("No valid articles remained after checking Gemini's output against the original RSS feed URLs.");
  }
  return validated;
}

async function publishArticles(articles, supabaseUrl, bearerToken) {
  let successCount = 0;
  for (const [index, article] of articles.entries()) {
    const response = await fetchWithRetry(
      supabaseUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(article),
      },
      `Supabase publish for article ${index + 1}`,
    );
    // Read body for diagnostics without printing credentials.
    const responseText = await response.text();
    console.log(`Published ${index + 1}/${articles.length}: ${article.title} (HTTP ${response.status})`);
    if (responseText.trim()) console.log(`Supabase response: ${responseText.slice(0, 300)}`);
    successCount += 1;
  }
  return successCount;
}

async function main() {
  const geminiApiKey = requiredEnv("GEMINI_API_KEY");
  const sourceArticles = await getHeadlines();
  const generated = await generateArticles(geminiApiKey, sourceArticles);
  const articles = validateAndNormalize(generated, sourceArticles);

  console.log(`Gemini generated ${generated.length} result(s); ${articles.length} article(s) passed validation.`);
  console.log("Article preview:");
  for (const [index, article] of articles.entries()) {
    console.log(`${index + 1}. [${article.category}] ${article.title}`);
  }

  if (!PUBLISH_ENABLED) {
    console.log("DRY RUN ONLY: Publishing is disabled. Nothing was sent to the website.");
    console.log("To publish manually, run the workflow again and check the publish box. To enable scheduled publishing, set repository variable PUBLISH_ENABLED to true after testing.");
    return;
  }

  const supabaseUrl = requiredEnv("SUPABASE_FUNCTION_URL");
  const bearerToken = requiredEnv("SUPABASE_BEARER_TOKEN");
  const count = await publishArticles(articles, supabaseUrl, bearerToken);
  console.log(`Finished successfully: ${count} article(s) sent to the website.`);
}

main().catch((error) => {
  console.error(`NEWS AUTOMATION FAILED: ${error?.message || error}`);
  process.exitCode = 1;
});
