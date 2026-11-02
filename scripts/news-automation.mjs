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
  { name: "ABC News", url: "https://abcnews.com/abcnews/usheadlines", category: "Politics" },
  { name: "CBS News", url: "https://www.cbsnews.com/latest/rss/main", category: "Politics" },
  { name: "NPR Politics", url: "https://feeds.npr.org/1014/rss.xml", category: "Politics" },
  { name: "PBS NewsHour", url: "https://www.pbs.org/newshour/feeds/rss/headlines", category: "Politics" },
  { name: "Fox News", url: "https://moxie.foxnews.com/google-publisher/latest.xml", category: "Politics" },
  { name: "BBC US and Canada", url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml", category: "Politics" },
  { name: "Politico", url: "https://rss.politico.com/politics-news.xml", category: "Politics" },
  { name: "The Hill", url: "https://thehill.com/feed/", category: "Politics" },
  { name: "Axios", url: "https://api.axios.com/feed/", category: "Politics" },
  { name: "ESPN", url: "https://www.espn.com/espn/rss/news", category: "Sports" },
  { name: "Fox Sports", url: "https://feeds.foxnews.com/foxnews/sports", category: "Sports" },
  { name: "Yahoo Sports", url: "https://sports.yahoo.com/rss/", category: "Sports" },
  { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", category: "Sports" },
  { name: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/", category: "Sports" },
  { name: "Sky Sports", url: "https://www.skysports.com/rss/12040", category: "Sports" },
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

function extractArticleText(html) {
  const jsonLdBodies = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .flatMap((raw) => {
      try {
        const parsed = JSON.parse(raw);
        const objects = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] || [])];
        return objects.map((item) => item?.articleBody || "").filter(Boolean);
      } catch { return []; }
    });
  const articleBody = jsonLdBodies.join(" ");
  const articleHtml = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
  const raw = articleBody || articleHtml || html;
  return cleanFeedText(raw
    .replace(/<(script|style|nav|footer|header|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
  ).slice(0, 6000);
}

async function enrichSourceArticles(articles) {
  const selected = [];
  for (const feed of RSS_FEEDS) {
    // Try the two newest stories per feed to diversify publishers while keeping page requests bounded.
    selected.push(...articles.filter((item) => item.source?.name === feed.name).slice(0, 2));
  }
  const enriched = await Promise.all(selected.map(async (article) => {
    try {
      const response = await fetchWithRetry(article.url, {
        headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "Mozilla/5.0 (compatible; USADailyNewsBot/1.0)" },
        signal: AbortSignal.timeout(10000),
      }, "Publisher article page", 1);
      const html = (await response.text()).slice(0, 1000000);
      const articleText = extractArticleText(html);
      return { ...article, article_text: articleText.length >= 500 ? articleText : "" };
    } catch (error) {
      console.warn("Could not retrieve full article text for " + article.source?.name + ": " + (error?.message || error));
      return { ...article, article_text: "" };
    }
  }));
  const byUrl = new Map(enriched.map((item) => [normalizedUrl(item.url), item]));
  return articles.map((item) => byUrl.get(normalizedUrl(item.url)) || item);
}

function titleTokens(value) {
  return new Set(String(value || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 3));
}

function relatedCoverageFor(article, allArticles) {
  const own = titleTokens(article.title);
  if (!own.size) return [];
  return allArticles
    .filter((other) => other.url !== article.url && other.source?.name !== article.source?.name)
    .map((other) => {
      const tokens = titleTokens(other.title);
      const overlap = [...own].filter((token) => tokens.has(token)).length / own.size;
      return { other, overlap };
    })
    .filter((item) => item.overlap >= 0.35)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3)
    .map(({ other }) => ({ source: other.source?.name, title: other.title, summary: other.description, url: other.url }));
}

function sourceEvidenceText(article) {
  return [article.title, article.description, article.content, article.article_text]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function highImpactTopic(generatedText) {
  const groups = [
    ["death or fatality", /\b(died|death|dead|killed|kills|fatal|fatalities)\b/i],
    ["injury or hospitalization", /\b(injured|wounded|hospitali[sz]ed|critical condition|surgery)\b/i],
    ["arrest or detention", /\b(arrested|detained|taken into custody)\b/i],
    ["criminal charge or conviction", /\b(charged|indicted|convicted|sentenced|acquitted)\b/i],
    ["court ruling", /\b(court ruling|judge (?:rules?|ruled)|court (?:rules?|ruled)|court blocked|throws? out (?:the )?(?:case|lawsuit|challenge)|dismissed (?:the )?(?:case|lawsuit|charges)|overturned (?:the )?(?:ruling|decision|verdict)|injunction)\b/i],
    ["election result", /\b(elected|reelected|re-elected|election winner|wins? the election|wins? the race)\b/i],
    ["endorsement", /\b(endorsed|endorsement|endorses)\b/i],
    ["job losses", /\b(layoffs?|laid off|job cuts|cuts? jobs)\b/i],
    ["financial distress", /\b(bankrupt|bankruptcy|insolvent|defaulted)\b/i],
  ];
  for (const [label, pattern] of groups) {
    if (pattern.test(generatedText)) return label;
  }
  return "";
}

function hasUnsupportedHighImpactClaim(generatedText, evidenceText) {
  const groups = [
    ["death or fatality", /\b(died|death|dead|killed|fatal|fatalities)\b/i],
    ["injury or hospitalization", /\b(injured|wounded|hospitali[sz]ed|critical condition|surgery)\b/i],
    ["arrest or detention", /\b(arrested|detained|taken into custody)\b/i],
    ["criminal charge or conviction", /\b(charged|indicted|convicted|sentenced|acquitted)\b/i],
    ["court ruling", /\b(ruled|ruling|throws? out|dismissed|overturned|blocked)\b/i],
    ["election result", /\b(won|wins|defeated|elected|reelected|re- elected)\b/i],
    ["endorsement", /\b(endorsed|endorsement|backs|backed)\b/i],
    ["job losses", /\b(layoffs?|laid off|job cuts|cuts? jobs)\b/i],
    ["financial distress", /\b(bankrupt|bankruptcy|insolvent|defaulted)\b/i],
  ];

  for (const [label, pattern] of groups) {
    if (pattern.test(generatedText) && !pattern.test(evidenceText)) return label;
  }
  return "";
}

function hasUnsupportedNumbers(generatedText, evidenceText) {
  const normalizeNumber = (value) => value.replace(/,/g, "").replace(/\.0+$/, "");
  const evidenceNumbers = new Set(
    (evidenceText.match(/\b\d[\d,]*(?:\.\d+)?%?\b|\$\s?\d[\d,]*(?:\.\d+)?/g) || [])
      .map(normalizeNumber)
  );
  const generatedNumbers = (generatedText.match(/\b\d[\d,]*(?:\.\d+)?%?\b|\$\s?\d[\d,]*(?:\.\d+)?/g) || [])
    .map(normalizeNumber);
  return generatedNumbers.find((number) => !evidenceNumbers.has(number)) || "";
}

function titleSimilarity(first, second) {
  const a = titleTokens(first);
  const b = titleTokens(second);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
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
  // Limit Gemini input to the 15 newest Politics and 15 newest Sports items.
  const recent = [...articles].sort((a, b) => (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0));
  const politics = recent.filter((item) => item.source_category === "Politics").slice(0, 15);
  const sports = recent.filter((item) => item.source_category === "Sports").slice(0, 15);
  const selected = [...politics, ...sports].sort((a, b) => (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0));
  console.log("Gemini candidate limit: " + selected.length + " stories (maximum 15 Politics + 15 Sports).");
  const enriched = await enrichSourceArticles(selected);
  const withCoverage = enriched.map((article) => ({ ...article, related_coverage: relatedCoverageFor(article, selected) }));
  const fullTextCount = withCoverage.filter((article) => article.article_text).length;
  const evidenceEligible = withCoverage.filter((article) => {
    const parts = [article.article_text, article.content, article.description]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .map((part) => part.trim());
    return [...new Set(parts)].join(" ").length >= 800;
  });
  console.log("Publisher page enrichment: " + fullTextCount + " of " + withCoverage.length + " stories have full article text.");
  console.log("Evidence-qualified stories sent to Gemini: " + evidenceEligible.length + " (minimum 800 distinct source characters).");
  if (evidenceEligible.length === 0) {
    throw new Error("No stories have enough source material (800 distinct characters). RSS feeds are returning summaries or publishers are blocking article retrieval; no weak articles will be generated.");
  }
  return evidenceEligible;
}

async function generateArticles(geminiApiKey, sourceArticles, retryFeedback = "") {
  // Send one compact, deduplicated evidence packet. Repeating the same RSS
  // text in description/content/article_text wastes free-tier input tokens.
  const candidates = sourceArticles.map((article, index) => {
    const evidenceParts = [article.article_text, article.content, article.description]
      .filter((part) => typeof part === "string" && part.trim())
      .map((part) => part.trim());
    const uniqueEvidence = [...new Set(evidenceParts)];
    const evidence = uniqueEvidence.join("\n").slice(0, 4500);
    return {
      id: index + 1,
      publisher: article.source?.name || "Unknown publisher",
      category: article.source_category,
      headline: article.title,
      published_at: article.publishedAt,
      source_url: article.url,
      evidence,
    };
  });

  const prompt = `You are an evidence-led editor for USA Daily News.
Review the numbered source candidates below independently. Select and write up to ${ARTICLE_COUNT} distinct stories that can provide genuine reader value. You are allowed to return fewer than the target. Do not return an empty array merely because some candidates are unsuitable: assess every candidate and include each suitable one.

For every article you include:
- Use only facts explicitly supported by that candidate's own evidence. The publisher name and source URL identify the evidence source.
- Attribute the central report to the named publisher in the opening paragraph.
- Write a clear, accurate headline and a useful, concise report. Do not pad or invent background.
- Preserve uncertainty and attribution. Never invent quotes, names, statistics, dates, causes, motives, context or details.
- Do not use another candidate as corroboration or borrow facts from it.
- Omit a candidate if its evidence is too thin, contradictory, unclear, or does not support a useful report.
- Hold for human review and omit any candidate whose central event involves death, serious injury, hospitalization, arrest, criminal charges, conviction, court ruling, election outcome, endorsement, layoffs, or financial distress.
- Keep every number, percentage, amount and date traceable to that candidate's evidence.
- Categorize as Politics, Tech, Economy, Culture, or Sports.
- Write an accurate SEO description of about 150 characters.

Return ONLY a valid JSON array. Each object must contain exactly these keys: title, content, category, source_url, image_url, seo_description.
Use the exact source_url from the selected candidate. Use null for image_url when no image URL is supplied. If no candidate meets every requirement, return [].

SOURCE CANDIDATES:
${JSON.stringify(candidates)}
${retryFeedback ? "\nRETRY GUIDANCE FROM THE PREVIOUS ATTEMPT:\n" + retryFeedback + "\nReassess the full candidate list and return a corrected JSON array. Do not repeat the previous mistake." : ""}`;

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
          maxOutputTokens: 30000,
        },
      }),
    },
    "Gemini article generation",
    1,
  );

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text || "").join("").trim();
  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(`Gemini returned no text.${blockReason ? ` Block reason: ${blockReason}` : " Check your API key, model, or API quota."}`);
  }

  const parsed = parseModelJson(text);
  if (parsed.length === 0) {
    console.error("Gemini diagnostic:", JSON.stringify({
      model: MODEL,
      finishReason: data?.candidates?.[0]?.finishReason,
      promptFeedback: data?.promptFeedback,
      candidateCount: data?.candidates?.length ?? 0,
      responseTextLength: text.length,
      responsePreview: text.slice(0, 500),
      candidateCountSent: candidates.length,
    }, null, 2));
    throw new Error("Gemini found no publishable stories in the supplied evidence. No articles were published.");
  }
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

    const evidenceParts = [original.article_text, original.content, original.description]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .map((part) => part.trim());
    const uniqueEvidence = [...new Set(evidenceParts)];
    const evidenceLength = uniqueEvidence.join(" ").length;
    const evidenceText = sourceEvidenceText(original);
    // Publisher article text is preferred; substantial RSS content is an acceptable fallback.
    const hasSubstantialEvidence = evidenceLength >= 800;
    const generatedText = title + " " + content + " " + seoDescription;
    const heldForHumanReview = highImpactTopic(generatedText);
    const unsupportedClaim = hasUnsupportedHighImpactClaim(generatedText, evidenceText);
    const unsupportedNumber = hasUnsupportedNumbers(generatedText, evidenceText);
    const sourceName = String(original.source?.name || "").replace(/\s*\(.+\)\s*$/, "").trim().toLowerCase();
    const attributedInOpening = sourceName && content.slice(0, 700).toLowerCase().includes(sourceName);
    const duplicateCoverage = validated.some((existing) => titleSimilarity(existing.title, title) >= 0.7);

    if (!title || !content || !seoDescription || !category || !hasSubstantialEvidence || content.length < 350) {
      console.warn(`Skipping an article with missing fields, insufficient distinct source evidence, or invalid category. Source: ${original.title}`);
      continue;
    }
    if (heldForHumanReview) {
      console.warn("Holding a high-impact story for human editorial review (" + heldForHumanReview + "). Source: " + original.title);
      continue;
    }
    if (!attributedInOpening) {
      console.warn("Skipping an article that does not identify its publisher in the opening 700 characters. Source: " + original.title);
      continue;
    }
    if (unsupportedClaim) {
      console.warn(`Skipping an article with a high-impact claim not found in its own source evidence (${unsupportedClaim}). Source: ${original.title}`);
      continue;
    }
    if (unsupportedNumber) {
      console.warn(`Skipping an article containing a number not found in its own source evidence (${unsupportedNumber}). Source: ${original.title}`);
      continue;
    }
    if (duplicateCoverage) {
      console.warn(`Skipping likely duplicate coverage based on headline similarity. Source: ${original.title}`);
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
  const GEMINI_MAX_RETRIES = 6;
  let generated;
  let articles;
  let lastGeminiError;
  let retryFeedback = "";

  // Six retries means up to seven total attempts (the first request plus six retries).
  // Each attempt includes generation AND local editorial validation.
  for (let attempt = 1; attempt <= GEMINI_MAX_RETRIES + 1; attempt += 1) {
    try {
      console.log(`Gemini attempt ${attempt}/${GEMINI_MAX_RETRIES + 1}.`);
      generated = await generateArticles(geminiApiKey, sourceArticles, retryFeedback);
      articles = validateAndNormalize(generated, sourceArticles);
      lastGeminiError = null;
      break;
    } catch (error) {
      lastGeminiError = error;
      retryFeedback = String(error?.message || error).slice(0, 1200);
      if (attempt > GEMINI_MAX_RETRIES) break;
      const delayMs = Math.min(30000, 2000 * (2 ** (attempt - 1)));
      console.warn(`Gemini attempt ${attempt} failed: ${retryFeedback}`);
      console.warn(`Retrying Gemini in ${Math.round(delayMs / 1000)} seconds (retry ${attempt} of ${GEMINI_MAX_RETRIES}).`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  if (lastGeminiError) {
    throw new Error(`Gemini failed after ${GEMINI_MAX_RETRIES} retries: ${lastGeminiError.message || lastGeminiError}`);
  }

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
