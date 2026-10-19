/**
 * Replaces the uploaded n8n flow:
 * NewsAPI US headlines -> Gemini -> JSON validation -> Supabase Edge Function.
 * Secrets are supplied by GitHub Actions, never stored in this file.
 */

const NEWS_API_URL = "https://newsapi.org/v2/top-headlines?country=us&pageSize=20";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const ARTICLE_COUNT = positiveInteger(process.env.ARTICLE_COUNT, 10);
const ARTICLE_WORDS = positiveInteger(process.env.ARTICLE_WORDS, 2000);
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

async function fetchWithRetry(url, options = {}, label = "request", attempts = 3) {
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

async function getHeadlines(newsApiKey) {
  const response = await fetchWithRetry(
    NEWS_API_URL,
    { headers: { "X-Api-Key": newsApiKey, Accept: "application/json" } },
    "NewsAPI headlines request",
  );
  const data = await response.json();
  if (data.status !== "ok" || !Array.isArray(data.articles)) {
    throw new Error(`NewsAPI returned an unexpected response: ${data.message || "No articles array"}`);
  }
  const articles = data.articles.filter((article) => article?.title && article?.url);
  if (articles.length === 0) throw new Error("NewsAPI returned no usable headlines.");
  console.log(`NewsAPI returned ${articles.length} usable headlines.`);
  return articles;
}

async function generateArticles(geminiApiKey, sourceArticles) {
  const prompt = `You are the Chief Editor of USA Daily News. Look at the raw news articles provided below. Select the ${ARTICLE_COUNT} top most impactful stories. For each story:
1. Rewrite the headline to be punchy and engaging.
2. Summarize the text into exactly ${ARTICLE_WORDS} words using simple language and fully SEO optimized.
3. Categorize it (Politics, Tech, Economy, or Culture).
4. Generate a 150-character SEO description.

Output the result strictly as a clean JSON array matching these keys: title, content, category, source_url, image_url, seo_description.

Here is the raw news data:
${JSON.stringify(sourceArticles.map((a) => ({
  title: a.title,
  description: a.description,
  content: a.content,
  source_name: a.source?.name,
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
  if (parsed.length === 0) throw new Error("Gemini returned an empty article list.");
  return parsed;
}

function validateAndNormalize(generated, sourceArticles) {
  const sourceByUrl = new Map(sourceArticles.map((article) => [normalizedUrl(article.url), article]));
  const allowedCategories = new Set(["Politics", "Tech", "Economy", "Culture"]);
  const seenSources = new Set();
  const validated = [];

  for (const article of generated) {
    if (!article || typeof article !== "object") continue;
    const sourceKey = normalizedUrl(article.source_url);
    const original = sourceByUrl.get(sourceKey);
    if (!original) {
      console.warn(`Skipping an article because its source_url did not match a URL returned by NewsAPI.`);
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
    throw new Error("No valid articles remained after checking Gemini's output against the original NewsAPI URLs.");
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
  const newsApiKey = requiredEnv("NEWSAPI_API_KEY");
  const geminiApiKey = requiredEnv("GEMINI_API_KEY");
  const sourceArticles = await getHeadlines(newsApiKey);
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
