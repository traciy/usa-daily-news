import { createHmac, randomBytes } from "node:crypto";
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
  // United States: national headlines and public affairs.
  { name: "NPR", url: "https://feeds.npr.org/1001/rss.xml", category: "Politics", country: "United States" },
  { name: "NBC News", url: "https://feeds.nbcnews.com/nbcnews/public/news", category: "Politics", country: "United States" },
  { name: "ABC News", url: "https://abcnews.go.com/abcnews/topstories", category: "Politics", country: "United States" },
  { name: "CBS News", url: "https://www.cbsnews.com/latest/rss/main", category: "Politics", country: "United States" },
  { name: "PBS NewsHour", url: "https://www.pbs.org/newshour/feeds/rss/headlines", category: "Politics", country: "United States" },
  { name: "Fox News", url: "https://moxie.foxnews.com/google-publisher/latest.xml", category: "Politics", country: "United States" },
  { name: "Politico", url: "https://rss.politico.com/politics-news.xml", category: "Politics", country: "United States" },
  { name: "The Hill", url: "https://thehill.com/feed/", category: "Politics", country: "United States" },
  { name: "Axios", url: "https://api.axios.com/feed/", category: "Politics", country: "United States" },
  { name: "CNN Top Stories", url: "https://edition.cnn.com/rss/cnn_topstories.rss", category: "Politics", country: "United States" },
  { name: "CNN US", url: "https://edition.cnn.com/rss/cnn_us.rss", category: "Politics", country: "United States" },
  { name: "CNN Politics", url: "https://edition.cnn.com/rss/cnn_allpolitics.rss", category: "Politics", country: "United States" },
  { name: "NPR Politics", url: "https://feeds.npr.org/1014/rss.xml", category: "Politics", country: "United States" },
  { name: "New York Times US", url: "https://rss.nytimes.com/services/xml/rss/nyt/US.xml", category: "Politics", country: "United States" },
  { name: "New York Times Politics", url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml", category: "Politics", country: "United States" },
  { name: "Associated Press via Flipboard", url: "https://flipboard.com/@associatedpress/top-stories-u7govdf1z.rss", category: "Politics", country: "United States" },

  // United States: business, finance and the economy.
  { name: "CNBC Top News", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", category: "Economy", country: "United States" },
  { name: "CNBC Economy", url: "https://www.cnbc.com/id/20910258/device/rss/rss.html", category: "Economy", country: "United States" },
  { name: "New York Times Business", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", category: "Economy", country: "United States" },
  { name: "MarketWatch Top Stories", url: "https://feeds.marketwatch.com/marketwatch/topstories/", category: "Economy", country: "United States" },
  { name: "Fortune", url: "https://fortune.com/feed/", category: "Economy", country: "United States" },
  { name: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex", category: "Economy", country: "United States" },

  // United States: technology, science and health.
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Tech", country: "United States" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Tech", country: "United States" },
  { name: "Wired", url: "https://www.wired.com/feed/rss", category: "Tech", country: "United States" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "Tech", country: "United States" },
  { name: "CNN Technology", url: "https://edition.cnn.com/rss/cnn_tech.rss", category: "Tech", country: "United States" },
  { name: "New York Times Technology", url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", category: "Tech", country: "United States" },
  { name: "New York Times Science", url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml", category: "Tech", country: "United States" },
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top/science.xml", category: "Tech", country: "United States" },
  { name: "CNN Health", url: "https://edition.cnn.com/rss/cnn_health.rss", category: "Culture", country: "United States" },
  { name: "New York Times Health", url: "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml", category: "Culture", country: "United States" },

  // United States: entertainment, film, television, music and culture.
  { name: "Variety", url: "https://variety.com/feed/", category: "Culture", country: "United States" },
  { name: "Deadline", url: "https://deadline.com/feed/", category: "Culture", country: "United States" },
  { name: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", category: "Culture", country: "United States" },
  { name: "Rolling Stone", url: "https://www.rollingstone.com/music/music-news/feed/", category: "Culture", country: "United States" },
  { name: "Billboard", url: "https://www.billboard.com/feed/", category: "Culture", country: "United States" },
  { name: "People", url: "https://people.com/feed/", category: "Culture", country: "United States" },
  { name: "New York Times Arts", url: "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml", category: "Culture", country: "United States" },
  { name: "New York Times Movies", url: "https://rss.nytimes.com/services/xml/rss/nyt/Movies.xml", category: "Culture", country: "United States" },
  { name: "CNN Entertainment", url: "https://edition.cnn.com/rss/cnn_showbiz.rss", category: "Culture", country: "United States" },

  // United States: sports across major leagues and college sports.
  { name: "ESPN Top News", url: "https://www.espn.com/espn/rss/news", category: "Sports", country: "United States" },
  { name: "ESPN NFL", url: "https://www.espn.com/espn/rss/nfl/news", category: "Sports", country: "United States" },
  { name: "ESPN NBA", url: "https://www.espn.com/espn/rss/nba/news", category: "Sports", country: "United States" },
  { name: "ESPN MLB", url: "https://www.espn.com/espn/rss/mlb/news", category: "Sports", country: "United States" },
  { name: "ESPN NHL", url: "https://www.espn.com/espn/rss/nhl/news", category: "Sports", country: "United States" },
  { name: "ESPN College Football", url: "https://www.espn.com/espn/rss/college-football/news", category: "Sports", country: "United States" },
  { name: "ESPN College Basketball", url: "https://www.espn.com/espn/rss/college-basketball/news", category: "Sports", country: "United States" },
  { name: "Fox Sports", url: "https://feeds.foxnews.com/foxnews/sports", category: "Sports", country: "United States" },
  { name: "Yahoo Sports", url: "https://sports.yahoo.com/rss/", category: "Sports", country: "United States" },
  { name: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/", category: "Sports", country: "United States" },
  { name: "New York Times Sports", url: "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml", category: "Sports", country: "United States" },
  { name: "CNN Sports", url: "https://edition.cnn.com/rss/cnn_sport.rss", category: "Sports", country: "United States" },

  // United Kingdom: national news, politics, business, technology, culture and sport.
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "World", country: "United Kingdom" },
  { name: "BBC UK", url: "https://feeds.bbci.co.uk/news/uk/rss.xml", category: "World", country: "United Kingdom" },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "Economy", country: "United Kingdom" },
  { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "Tech", country: "United Kingdom" },
  { name: "BBC Science and Environment", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", category: "Tech", country: "United Kingdom" },
  { name: "BBC Entertainment and Arts", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", category: "Culture", country: "United Kingdom" },
  { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", category: "Sports", country: "United Kingdom" },
  { name: "BBC Football", url: "https://feeds.bbci.co.uk/sport/football/rss.xml", category: "Sports", country: "United Kingdom" },
  { name: "The Guardian UK News", url: "https://www.theguardian.com/uk-news/rss", category: "World", country: "United Kingdom" },
  { name: "The Guardian UK Politics", url: "https://www.theguardian.com/politics/rss", category: "Politics", country: "United Kingdom" },
  { name: "The Guardian UK Business", url: "https://www.theguardian.com/uk/business/rss", category: "Economy", country: "United Kingdom" },
  { name: "The Guardian UK Technology", url: "https://www.theguardian.com/uk/technology/rss", category: "Tech", country: "United Kingdom" },
  { name: "The Guardian UK Culture", url: "https://www.theguardian.com/uk/culture/rss", category: "Culture", country: "United Kingdom" },
  { name: "The Guardian Football", url: "https://www.theguardian.com/football/rss", category: "Sports", country: "United Kingdom" },
  { name: "The Guardian UK Sport", url: "https://www.theguardian.com/uk/sport/rss", category: "Sports", country: "United Kingdom" },
  { name: "Sky News World", url: "https://feeds.skynews.com/feeds/rss/world.xml", category: "World", country: "United Kingdom" },
  { name: "Sky News UK", url: "https://feeds.skynews.com/feeds/rss/uk.xml", category: "World", country: "United Kingdom" },
  { name: "Sky News Business", url: "https://feeds.skynews.com/feeds/rss/business.xml", category: "Economy", country: "United Kingdom" },
  { name: "Sky News Politics", url: "https://feeds.skynews.com/feeds/rss/politics.xml", category: "Politics", country: "United Kingdom" },
  { name: "Sky News Technology", url: "https://feeds.skynews.com/feeds/rss/technology.xml", category: "Tech", country: "United Kingdom" },
  { name: "Sky News Entertainment", url: "https://feeds.skynews.com/feeds/rss/entertainment.xml", category: "Culture", country: "United Kingdom" },
  { name: "The Independent UK", url: "https://www.independent.co.uk/news/uk/rss", category: "World", country: "United Kingdom" },
  { name: "RTÉ News", url: "https://www.rte.ie/feeds/rss/?index=/news/", category: "World", country: "Ireland" },

  // Canada: national news, politics, business, technology, arts, health and sports.
  { name: "CBC Top Stories", url: "https://www.cbc.ca/webfeed/rss/rss-topstories", category: "World", country: "Canada" },
  { name: "CBC Canada", url: "https://www.cbc.ca/webfeed/rss/rss-canada", category: "World", country: "Canada" },
  { name: "CBC Politics", url: "https://www.cbc.ca/webfeed/rss/rss-politics", category: "Politics", country: "Canada" },
  { name: "CBC Business", url: "https://www.cbc.ca/webfeed/rss/rss-business", category: "Economy", country: "Canada" },
  { name: "CBC Technology", url: "https://www.cbc.ca/webfeed/rss/rss-technology", category: "Tech", country: "Canada" },
  { name: "CBC Arts", url: "https://www.cbc.ca/webfeed/rss/rss-arts", category: "Culture", country: "Canada" },
  { name: "CBC Health", url: "https://www.cbc.ca/webfeed/rss/rss-health", category: "Culture", country: "Canada" },
  { name: "CBC Sports", url: "https://www.cbc.ca/webfeed/rss/rss-sports", category: "Sports", country: "Canada" },
  { name: "CBC NHL", url: "https://www.cbc.ca/webfeed/rss/rss-sports-nhl", category: "Sports", country: "Canada" },
  { name: "CBC NBA", url: "https://www.cbc.ca/webfeed/rss/rss-sports-nba", category: "Sports", country: "Canada" },
  { name: "CBC Soccer", url: "https://www.cbc.ca/webfeed/rss/rss-sports-soccer", category: "Sports", country: "Canada" },
  { name: "CTV News Canada", url: "https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009", category: "World", country: "Canada" },
  { name: "Global News Canada", url: "https://globalnews.ca/feed/", category: "World", country: "Canada" },
  { name: "Financial Post", url: "https://financialpost.com/feed/", category: "Economy", country: "Canada" },
  { name: "National Post", url: "https://nationalpost.com/feed/", category: "World", country: "Canada" },

  // Additional Canadian regional and specialist coverage from Global News.
  { name: "Global News BC", url: "https://globalnews.ca/bc/feed/", category: "World", country: "Canada" },
  { name: "Global News Calgary", url: "https://globalnews.ca/calgary/feed/", category: "World", country: "Canada" },
  { name: "Global News Edmonton", url: "https://globalnews.ca/edmonton/feed/", category: "World", country: "Canada" },
  { name: "Global News Halifax", url: "https://globalnews.ca/halifax/feed/", category: "World", country: "Canada" },
  { name: "Global News Montreal", url: "https://globalnews.ca/montreal/feed/", category: "World", country: "Canada" },
  { name: "Global News Ottawa", url: "https://globalnews.ca/ottawa/feed/", category: "World", country: "Canada" },
  { name: "Global News Toronto", url: "https://globalnews.ca/toronto/feed/", category: "World", country: "Canada" },
  { name: "Global News Winnipeg", url: "https://globalnews.ca/winnipeg/feed/", category: "World", country: "Canada" },
  { name: "Global News Politics", url: "https://globalnews.ca/politics/feed/", category: "Politics", country: "Canada" },
  { name: "Global News Money", url: "https://globalnews.ca/money/feed/", category: "Economy", country: "Canada" },
  { name: "Global News Health", url: "https://globalnews.ca/health/feed/", category: "Culture", country: "Canada" },
  { name: "Global News Entertainment", url: "https://globalnews.ca/entertainment/feed/", category: "Culture", country: "Canada" },
  { name: "Global News Sports", url: "https://globalnews.ca/sports/feed/", category: "Sports", country: "Canada" },
  { name: "Global News Environment", url: "https://globalnews.ca/environment/feed/", category: "Tech", country: "Canada" },
  { name: "CBC World", url: "https://www.cbc.ca/webfeed/rss/rss-world", category: "World", country: "Canada" },

  // Australia: national news, business, technology, culture and sport.
  { name: "ABC News Australia", url: "https://www.abc.net.au/news/feed/51120/rss.xml", category: "World", country: "Australia" },
  { name: "ABC News Australia Top Stories", url: "https://www.abc.net.au/news/feed/1948/rss.xml", category: "World", country: "Australia" },
  { name: "The Guardian Australia News", url: "https://www.theguardian.com/australia-news/rss", category: "World", country: "Australia" },
  { name: "The Guardian Australia Business", url: "https://www.theguardian.com/au/business/rss", category: "Economy", country: "Australia" },
  { name: "The Guardian Australia Technology", url: "https://www.theguardian.com/au/technology/rss", category: "Tech", country: "Australia" },
  { name: "The Guardian Australia Culture", url: "https://www.theguardian.com/au/culture/rss", category: "Culture", country: "Australia" },
  { name: "The Guardian Australia Sport", url: "https://www.theguardian.com/au/sport/rss", category: "Sports", country: "Australia" },
  { name: "The Guardian Australia Football", url: "https://www.theguardian.com/football/rss", category: "Sports", country: "Australia" },
  { name: "Sydney Morning Herald", url: "https://www.smh.com.au/rss/feed.xml", category: "World", country: "Australia" },
  { name: "The Age Australia", url: "https://www.theage.com.au/rss/feed.xml", category: "World", country: "Australia" },
  { name: "SBS News Australia", url: "https://www.sbs.com.au/news/feed", category: "World", country: "Australia" },

  { name: "BBC England", url: "https://feeds.bbci.co.uk/news/england/rss.xml", category: "World", country: "United Kingdom" },
  { name: "BBC Scotland", url: "https://feeds.bbci.co.uk/news/scotland/rss.xml", category: "World", country: "United Kingdom" },
  { name: "BBC Wales", url: "https://feeds.bbci.co.uk/news/wales/rss.xml", category: "World", country: "United Kingdom" },

  // Additional UK coverage: devolved nations, public services and specialist sport.
  { name: "BBC Northern Ireland", url: "https://feeds.bbci.co.uk/news/northern_ireland/rss.xml", category: "World", country: "United Kingdom" },
  { name: "BBC Politics", url: "https://feeds.bbci.co.uk/news/politics/rss.xml", category: "Politics", country: "United Kingdom" },
  { name: "BBC Health", url: "https://feeds.bbci.co.uk/news/health/rss.xml", category: "Culture", country: "United Kingdom" },
  { name: "BBC Education", url: "https://feeds.bbci.co.uk/news/education/rss.xml", category: "Culture", country: "United Kingdom" },
  { name: "BBC Cricket", url: "https://feeds.bbci.co.uk/sport/cricket/rss.xml", category: "Sports", country: "United Kingdom" },
  { name: "BBC Golf", url: "https://feeds.bbci.co.uk/sport/golf/rss.xml", category: "Sports", country: "United Kingdom" },
  { name: "BBC Rugby Union", url: "https://feeds.bbci.co.uk/sport/rugby-union/rss.xml", category: "Sports", country: "United Kingdom" },

  // Additional Australian national, state, politics, science, culture and sport feeds.
  { name: "ABC Australia Politics", url: "https://www.abc.net.au/news/feed/1534/rss.xml", category: "Politics", country: "Australia" },
  { name: "ABC Australia Sport", url: "https://www.abc.net.au/news/feed/2942460/rss.xml", category: "Sports", country: "Australia" },
  { name: "ABC Australia Science", url: "https://www.abc.net.au/news/feed/8132426/rss.xml", category: "Tech", country: "Australia" },
  { name: "ABC Australia Health", url: "https://www.abc.net.au/news/feed/9167762/rss.xml", category: "Culture", country: "Australia" },
  { name: "ABC Australia Arts and Entertainment", url: "https://www.abc.net.au/news/feed/472/rss.xml", category: "Culture", country: "Australia" },
  { name: "ABC Australia Queensland", url: "https://www.abc.net.au/news/feed/5555988/rss.xml", category: "World", country: "Australia" },
  { name: "ABC Australia Adelaide", url: "https://www.abc.net.au/news/feed/8057540/rss.xml", category: "World", country: "Australia" },
  { name: "ABC Australia Brisbane", url: "https://www.abc.net.au/news/feed/8053540/rss.xml", category: "World", country: "Australia" },
  { name: "ABC Australia Canberra", url: "https://www.abc.net.au/news/feed/8057234/rss.xml", category: "World", country: "Australia" },
  { name: "ABC Australia Darwin", url: "https://www.abc.net.au/news/feed/8057648/rss.xml", category: "World", country: "Australia" },
  { name: "ABC Australia Hobart", url: "https://www.abc.net.au/news/feed/8054562/rss.xml", category: "World", country: "Australia" },
  { name: "ABC Australia Melbourne", url: "https://www.abc.net.au/news/feed/8057136/rss.xml", category: "World", country: "Australia" },
  { name: "ABC Australia Perth", url: "https://www.abc.net.au/news/feed/8057096/rss.xml", category: "World", country: "Australia" },
  { name: "ABC Australia Sydney", url: "https://www.abc.net.au/news/feed/8055316/rss.xml", category: "World", country: "Australia" },

  // New Zealand.
  { name: "RNZ", url: "https://www.rnz.co.nz/rss/national.xml", category: "World", country: "New Zealand" },

  // Continental Europe.
  { name: "Deutsche Welle", url: "https://rss.dw.com/xml/rss-en-all", category: "World", country: "Germany" },
  { name: "tagesschau", url: "https://www.tagesschau.de/index~rss2.xml", category: "World", country: "Germany" },
  { name: "France 24", url: "https://www.france24.com/en/rss", category: "World", country: "France" },
  { name: "Le Monde English", url: "https://www.lemonde.fr/en/rss/une.xml", category: "World", country: "France" },
  { name: "ARTE News", url: "https://www.arte.tv/sites/news/feed/", category: "World", country: "France" },
  { name: "Euronews", url: "https://www.euronews.com/rss", category: "World", country: "European Union" },
  { name: "Politico Europe", url: "https://www.politico.eu/feed/", category: "World", country: "European Union" },
  { name: "NOS News", url: "https://feeds.nos.nl/nosnieuwsalgemeen", category: "World", country: "Netherlands" },
  { name: "ANSA English", url: "https://www.ansa.it/english/news/english_rss.xml", category: "World", country: "Italy" },

  // Asia-Pacific and international publishers.
  { name: "NHK World", url: "https://www3.nhk.or.jp/rssxml/news/globalnewsroom.xml", category: "World", country: "Japan" },
  { name: "CNA", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", category: "World", country: "Singapore" },
  { name: "Yonhap News", url: "https://en.yna.co.kr/RSS/news.xml", category: "World", country: "South Korea" },
  { name: "Times of India", url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", category: "World", country: "India" },
  { name: "Al Jazeera English", url: "https://www.aljazeera.com/xml/rss/all.xml", category: "World", country: "Qatar" },
  { name: "TRT World", url: "https://www.trtworld.com/rss", category: "World", country: "Türkiye" },
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

function extractArticleImage(html, pageUrl) {
  const values = [];
  const add = (value) => {
    if (!value || typeof value !== 'string') return;
    let url;
    try { url = new URL(decodeXml(value.trim()), pageUrl).toString(); } catch { return; }
    if (!/^https?:/i.test(url) || /\b(logo|avatar|icon|favicon|sprite|placeholder|pixel)\b/i.test(url) || /\.(svg|gif)(?:[?#]|$)/i.test(url)) return;
    if (!values.includes(url)) values.push(url);
  };
  const patterns = [
    /<meta\b[^>]*(?:property|name)=["']og:image(?:[:][^"']*)?["'][^>]*content=["']([^"']+)["'][^>]*>/ig,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image(?:[:][^"']*)?["'][^>]*>/ig,
    /<meta\b[^>]*(?:name|property)=["']twitter:image(?:[:][^"']*)?["'][^>]*content=["']([^"']+)["'][^>]*>/ig
  ];
  for (const pattern of patterns) for (const match of html.matchAll(pattern)) add(match[1]);
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/ig)) {
    try {
      const parsed = JSON.parse(match[1]);
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== 'object') continue;
        if (Array.isArray(item)) { queue.push(...item); continue; }
        if (item['@graph']) queue.push(...(Array.isArray(item['@graph']) ? item['@graph'] : [item['@graph']]));
        const imgs = Array.isArray(item.image) ? item.image : [item.image];
        for (const img of imgs) add(typeof img === 'string' ? img : img?.url || img?.contentUrl);
      }
    } catch { /* Ignore invalid publisher metadata. */ }
  }
  const articleHtml = html.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1] || html;
  for (const match of articleHtml.matchAll(/<img\b[^>]*(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/ig)) add(match[1]);
  return values[0] || null;
}
async function backfillMissingArticleImages(functionUrl, bearerToken) {
  const lookupUrl = new URL(functionUrl);
  lookupUrl.searchParams.set('missing_images', 'true');
  const lookup = await fetchWithRetry(lookupUrl.toString(), {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + bearerToken, Accept: 'application/json' },
  }, 'Missing article image lookup', 2);
  const payload = await lookup.json();
  const missing = Array.isArray(payload?.articles) ? payload.articles : [];
  if (!missing.length) { console.log('Image backfill: no existing articles are missing images.'); return; }
  console.log('Image backfill: checking ' + missing.length + ' existing article(s) without images.');
  const updates = (await Promise.all(missing.map(async (article) => {
    if (!article?.id || !article?.source_url || !/^https?:\/\//i.test(article.source_url)) return null;
    try {
      const response = await fetch(article.source_url, {
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; USADailyNewsBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return null;
      const html = (await response.text()).slice(0, 1000000);
      const imageUrl = extractArticleImage(html, article.source_url);
      if (!imageUrl) { console.log('No usable publisher image found for existing article ' + article.id + '.'); return null; }
      console.log('Recovered image for existing article ' + article.id + '.');
      return { id: article.id, image_url: imageUrl };
    } catch (error) {
      console.warn('Image recovery failed for existing article ' + article.id + ': ' + (error?.message || error));
      return null;
    }
  }))).filter(Boolean);
  if (!updates.length) { console.log('Image backfill: no publisher images could be recovered.'); return; }
  const saved = await fetchWithRetry(functionUrl, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + bearerToken, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ image_updates: updates }),
  }, 'Save recovered article images', 2);
  const result = await saved.json();
  console.log('Image backfill saved ' + Number(result.updated || 0) + ' of ' + updates.length + ' recovered image(s).');
  if (result.rejected?.length) console.warn('Image backfill rejections: ' + JSON.stringify(result.rejected.slice(0, 5)));
}
async function enrichSourceArticles(articles) {
  const selected = [];
  for (const feed of RSS_FEEDS) {
    // Try up to ten newest stories per feed, subject to the overall balanced candidate limits below.
    selected.push(...articles.filter((item) => item.source?.name === feed.name).slice(0, 10));
  }
  const enriched = await Promise.all(selected.map(async (article) => {
    try {
      const response = await fetchWithRetry(article.url, {
        headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "Mozilla/5.0 (compatible; USADailyNewsBot/1.0)" },
        signal: AbortSignal.timeout(10000),
      }, "Publisher article page", 1);
      const html = (await response.text()).slice(0, 1000000);
      const articleText = extractArticleText(html);
      const pageImage = article.urlToImage || extractArticleImage(html, article.url);
      if (!article.urlToImage && pageImage) console.log("Recovered publisher image for: " + article.title);
      return { ...article, urlToImage: pageImage, article_text: articleText.length >= 500 ? articleText : "" };
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
    const atomHref = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1];
    const link = decodeXml(rawLink.replace(/<[^>]+>/g, "").trim() || href || atomHref || "");
    const rawDate = getXmlTag(block, ["pubDate", "published", "updated", "dc:date"]);
    const image = block.match(/<(?:media:content|media:thumbnail|enclosure|itunes:image)\b[^>]*(?:\burl|\bhref)=["']([^"']+)["']/i)?.[1]
      || block.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1]
      || null;
    let publishedAt = null;
    if (rawDate) {
      const parsedDate = Date.parse(cleanFeedText(rawDate));
      if (Number.isFinite(parsedDate)) publishedAt = new Date(parsedDate).toISOString();
    }
    return {
      title, description: description.slice(0, 3000), content: content.slice(0, 5000),
      url: normalizedUrl(link), publishedAt, source: { name: feed.name, country: feed.country },
      source_category: feed.category, urlToImage: image ? decodeXml(image) : null,
    };
  }).filter((article) => {
    if (!article.title || !article.url || !/^https?:\/\//i.test(article.url)) return false;
    if (article.publishedAt) return Date.now() - Date.parse(article.publishedAt) <= 48 * 60 * 60 * 1000;
    return true;
  });
}

function selectBalancedByCountry(items, limit) {
  const groups = new Map();
  for (const item of items) {
    const country = item.source?.country || "International";
    if (!groups.has(country)) groups.set(country, []);
    groups.get(country).push(item);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const evidenceA = [a.article_text, a.content, a.description].filter(Boolean).join(" ").length;
      const evidenceB = [b.article_text, b.content, b.description].filter(Boolean).join(" ").length;
      // Prefer candidates with substantial primary-source material; use recency as the tie-breaker.
      return evidenceB - evidenceA || (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0);
    });
  }
  const countries = [...groups.keys()].sort((a, b) => {
    const timeA = Date.parse(groups.get(a)[0]?.publishedAt || "") || 0;
    const timeB = Date.parse(groups.get(b)[0]?.publishedAt || "") || 0;
    return timeB - timeA || a.localeCompare(b);
  });
  const selected = [];
  for (let round = 0; selected.length < limit; round += 1) {
    let added = false;
    for (const country of countries) {
      const candidate = groups.get(country)[round];
      if (candidate) {
        selected.push(candidate);
        added = true;
        if (selected.length >= limit) break;
      }
    }
    if (!added) break;
  }
  return selected;
}

function selectUsPublisherFirst(items, limit) {
  const usPublishers = items.filter((item) => item.source?.country === "United States");
  const otherPublishers = items.filter((item) => item.source?.country !== "United States");
  const preferredUsCount = Math.min(usPublishers.length, Math.ceil(limit * 0.7));
  const usSelection = selectBalancedByCountry(usPublishers, preferredUsCount);
  const internationalSelection = selectBalancedByCountry(otherPublishers, limit - usSelection.length);
  return [...usSelection, ...internationalSelection]
    .sort((a, b) => (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0));
}

async function getHeadlines(publishedArticles = []) {
  const publishedUrls = new Set(publishedArticles.map((item) => normalizedUrl(item.source_url)).filter(Boolean));
  const publishedTitles = publishedArticles.map((item) => String(item.title || "")).filter(Boolean);
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
  // Keep the Gemini/free-tier workload bounded while drawing from the expanded
  // international news pool and preserving a separate sports allocation.
  const recent = [...articles].sort((a, b) => (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0));
  // Round-robin by publisher country so high-volume US/UK feeds cannot crowd out other markets.
  const generalNews = selectBalancedByCountry(recent.filter((item) => item.source_category !== "Sports"), 20);
  const sports = selectBalancedByCountry(recent.filter((item) => item.source_category === "Sports"), 20);
  const selected = [...generalNews, ...sports].sort((a, b) => (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0));
  const countries = [...new Set(selected.map((item) => item.source?.country).filter(Boolean))];
  console.log("Gemini candidate limit: " + selected.length + " stories (maximum 20 general news + 20 sports) from " + countries.length + " countries/regions: " + countries.join(", ") + ".");
  const enriched = await enrichSourceArticles(selected);
  const withCoverage = enriched.map((article) => ({ ...article, related_coverage: relatedCoverageFor(article, selected) }));
  const fullTextCount = withCoverage.filter((article) => article.article_text).length;
  const evidenceQualified = withCoverage.filter((article) => {
    const parts = [article.article_text, article.content, article.description]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .map((part) => part.trim());
    return [...new Set(parts)].join(" ").length >= 800;
  });
  // Balance again after enrichment so accessible publishers do not create a new country bias.
  const notPreviouslyPublished = evidenceQualified.filter((article) => {
    if (publishedUrls.has(normalizedUrl(article.url))) return false;
    return !publishedTitles.some((title) => titleSimilarity(title, article.title) >= 0.65);
  });
  const evidenceEligible = selectUsPublisherFirst(notPreviouslyPublished, 10);
  console.log("Previously published stories skipped: " + (evidenceQualified.length - notPreviouslyPublished.length) + ".");
  const evidenceCountries = [...new Set(evidenceEligible.map((article) => article.source?.country).filter(Boolean))];
  console.log("Evidence-qualified country coverage: " + evidenceCountries.length + " countries/regions: " + evidenceCountries.join(", "));
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

  const prompt = `You are an evidence-led news editor for USA Daily News.
Review every numbered source candidate independently. Select and write up to ${ARTICLE_COUNT} distinct stories that provide genuine reader value. Returning fewer than the target is acceptable. Never force ten stories and never return an empty array if suitable candidates exist.

Editorial and evidence rules:
- Use only facts explicitly supported by that candidate's own evidence. Do not use another candidate as corroboration or borrow facts from it.
- Attribute the central report to the named publisher in the opening paragraph and use the exact supplied source_url. Keep that source link visible to readers.
- Do not invent an author, reporter, eyewitness, exclusive access, interview, or original on-the-ground reporting. Do not imply USA Daily News independently witnessed or verified events unless the evidence says so.
- Write in original wording; do not copy or closely paraphrase publisher sentences. Use direct quotations only when essential, accurately attributed, and supported by the evidence.
- Write a complete, clear report whose length matches the amount and quality of verified evidence. Aim for about ${ARTICLE_WORDS} words when the source supports that much detail. A concise, complete report is better than a padded long article. Google does not require a preferred word count.
- Do not invent or infer missing background to make an article longer. Never repeat the same point in different words. If the source supports only a short update, write a short update; omit it only when the evidence is too thin to explain what happened accurately and usefully.
- Explain the confirmed event, the key people or organizations involved, relevant dates/locations, verified details, and any stated next steps or implications, but include each only when the candidate's evidence supports it.
- Use natural paragraphs with clear transitions. Do not follow a fixed paragraph count. H2 subheadings are optional; use concise descriptive headings only when they genuinely improve navigation, especially for longer reports. Do not add headings merely to satisfy a count.

Basic SEO and presentation:
- Write a clear, accurate headline that naturally names the main subject and important development. Keep it to 110 characters or fewer; avoid clickbait and keyword stuffing.
- Write a concise, natural meta description that accurately summarizes the article and includes the main subject when appropriate. Do not force a character count.
- Use the main search phrase naturally where it fits, especially in the headline and opening, without repeating it unnaturally.
- Avoid generic introductions, repeated conclusions, padded background, sensational language, and vague phrases that add no factual value.
- Use an image only when the supplied source image is relevant to the exact story; otherwise use null.
- Make the report easy to read and explain what happened near the beginning.

Accuracy and safety:
- Preserve uncertainty and attribution. Never invent quotes, names, statistics, dates, causes, motives, reactions, context or details.
- Keep every number, percentage, amount and date traceable to that candidate's evidence.
- Omit a candidate if its evidence is contradictory, unclear, too thin for a useful report, or if it would require speculation.
- Hold for human review and omit any candidate whose central event involves death, serious injury, hospitalization, arrest, criminal charges, conviction, court ruling, election outcome, endorsement, layoffs or financial distress.
- Categorize each article as Politics, Tech, Economy, Culture or Sports.
- Return content as Markdown. Return only these existing fields: title, content, category, source_url, image_url, seo_description.

Return ONLY a valid JSON array. Each object must contain exactly these keys: title, content, category, source_url, image_url, seo_description.
Before returning, check that each report is factual, useful, clearly written, sufficiently developed for its evidence, and attributed in the opening. Keep the meta description concise and accurate without a fixed character count. Do not enforce a fixed word, paragraph or heading count. Use the exact source_url from the selected candidate. Use null for image_url when no image URL is supplied. If no candidate is suitable, return [].

SOURCE CANDIDATES:
${JSON.stringify(candidates)}
${retryFeedback ? "\nRETRY GUIDANCE FROM THE PREVIOUS ATTEMPT:\n" + retryFeedback + "\nCorrect the stated issues while reassessing the full candidate list. Do not weaken evidence or safety rules." : ""}`;

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

function normalizedParagraphs(markdown) {
  return String(markdown || "").split(/\n{2,}/)
    .map((part) => part.replace(/[#*_>]/g, " ").replace(/[^a-z0-9 ]/gi, " ").replace(/\s+/g, " ").trim().toLowerCase())
    .filter((part) => part.length >= 80);
}

function validateAndNormalize(generated, sourceArticles) {
  const sourceByUrl = new Map(sourceArticles.map((article) => [normalizedUrl(article.url), article]));
  const allowedCategories = new Set(["Politics", "Tech", "Economy", "Culture", "Sports"]);
  const seenSources = new Set();
  const validated = [];
  const rejectionReasons = [];

  for (const article of generated) {
    if (!article || typeof article !== "object") continue;
    const sourceKey = normalizedUrl(article.source_url);
    const original = sourceByUrl.get(sourceKey);
    if (!original) {
      const reason = "Returned source_url did not match one of the collected RSS source URLs.";
      console.warn("Skipping an article: " + reason);
      rejectionReasons.push(reason);
      continue;
    }
    if (seenSources.has(sourceKey)) {
      const reason = `Duplicate source article: ${original.title}`;
      console.warn("Skipping an article: " + reason);
      rejectionReasons.push(reason);
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
    const paragraphs = normalizedParagraphs(content);
    const repeatedParagraphs = paragraphs.length > 1 && new Set(paragraphs).size < paragraphs.length;

    const normalizedParagraphText = content.replace(/<[^>]*>/g, " ").trim();
    const wordCount = normalizedParagraphText.split(/\s+/).filter(Boolean).length;
    const descriptionLength = seoDescription.length;
    const titleLength = title.length;
    const primaryTerms = title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((term) => term.length > 3);
    const openingText = normalizedParagraphText.slice(0, 700).toLowerCase();
    const primaryTermCoverage = primaryTerms.length
      ? primaryTerms.filter((term) => openingText.includes(term)).length / primaryTerms.length
      : 0;

    const qualityIssues = [];
    if (!title) qualityIssues.push("missing headline");
    if (title.length > 110) qualityIssues.push("headline exceeds Google's 110-character News headline guidance");
    if (/[!?]{2,}|\b(you won.t believe|shocking|must see|unbelievable)\b/i.test(title)) qualityIssues.push("headline uses clickbait wording");
    if (!content || content.length < 350) qualityIssues.push("article body is missing or too short");
    if (!seoDescription) qualityIssues.push("missing meta description");
    if (!category) qualityIssues.push("category is missing or unsupported");
    if (!hasSubstantialEvidence) qualityIssues.push("source evidence is below the 800-character threshold");
    if (repeatedParagraphs) qualityIssues.push("article repeats one or more paragraphs");
    if (qualityIssues.length) {
      const reason = `${original.title}: ${qualityIssues.join("; ")}`;
      console.warn("Skipping an article that fails editorial/on-page checks (" + reason + ").");
      rejectionReasons.push(reason);
      continue;
    }
    if (heldForHumanReview) {
      const reason = `${original.title}: held for human review because it concerns ${heldForHumanReview}`;
      console.warn(reason);
      rejectionReasons.push(reason);
      continue;
    }
    if (!attributedInOpening) {
      const reason = `${original.title}: identify ${original.source?.name || "the publisher"} in the opening paragraph`;
      console.warn(reason);
      rejectionReasons.push(reason);
      continue;
    }
    if (unsupportedClaim) {
      const reason = `${original.title}: unsupported high-impact claim (${unsupportedClaim}); remove it or omit the story`;
      console.warn(reason);
      rejectionReasons.push(reason);
      continue;
    }
    if (unsupportedNumber) {
      const reason = `${original.title}: unsupported number (${unsupportedNumber}); remove it or omit the story`;
      console.warn(reason);
      rejectionReasons.push(reason);
      continue;
    }
    if (duplicateCoverage) {
      const reason = `${original.title}: likely duplicate coverage of another selected story`;
      console.warn(reason);
      rejectionReasons.push(reason);
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
    const details = rejectionReasons.slice(0, 8).join(" | ");
    throw new Error("No articles passed the editorial checks. " + (details || "Gemini returned no usable article objects."));
  }
  return validated;
}


const X_KEYWORD_STOPWORDS = new Set([
  "about", "after", "against", "also", "among", "another", "around", "because",
  "before", "being", "between", "could", "first", "from", "have", "into", "just",
  "more", "most", "news", "over", "said", "says", "than", "that", "their",
  "there", "these", "they", "this", "those", "through", "today", "under",
  "until", "were", "what", "when", "where", "which", "while", "will", "with",
  "would", "your", "amid", "amidst", "report", "reports", "update", "updates",
  "latest", "video", "photos", "explained"
]);

function extractArticleKeywords(article, maximum = 4) {
  const title = String(article.title || "");
  const description = String(article.seo_description || "");
  const words = (title + " " + description).match(/[A-Za-z][A-Za-z0-9'-]{2,}/g) || [];
  const titleWords = title.match(/[A-Za-z][A-Za-z0-9'-]{2,}/g) || [];
  const seen = new Set();
  const keywords = [];

  for (const rawWord of [...titleWords, ...words]) {
    const word = rawWord.replace(/^['-]+|['-]+$/g, "");
    const normalized = word.toLowerCase();
    if (word.length < 3 || X_KEYWORD_STOPWORDS.has(normalized) || seen.has(normalized) || /^\d+$/.test(word)) continue;
    seen.add(normalized);
    keywords.push(word);
    if (keywords.length >= maximum) break;
  }
  return keywords;
}

function articleHashtag(value) {
  const words = String(value || "").match(/[A-Za-z0-9]+/g) || [];
  if (!words.length) return "";
  const tag = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  return tag.length >= 3 && tag.length <= 30 ? "#" + tag : "";
}

function buildXPostText(article, articleUrl) {
  // Keep the exact headline published on the website; do not generate a different story.
  const headline = String(article.title || "Latest news").replace(/\s+/g, " ").trim();
  const keywords = extractArticleKeywords(article, 4);
  const categoryTags = {
    Politics: "#Politics",
    Tech: "#Technology",
    Economy: "#Business",
    Culture: "#Entertainment",
    Sports: "#Sports",
  };
  const hashtags = [];
  const categoryTag = categoryTags[article.category];
  if (categoryTag) hashtags.push(categoryTag);
  const subjectTag = articleHashtag(keywords[0]);
  if (subjectTag && !hashtags.includes(subjectTag)) hashtags.push(subjectTag);

  const formatTopics = () => [...keywords, ...hashtags];
  const makeSuffix = () => {
    const items = formatTopics();
    const line = items.length ? "Topics: " + items.join(", ") : "";
    return (line ? "\n" + line : "") + "\n" + articleUrl;
  };

  let suffix = makeSuffix();
  let headlineBudget = Math.max(35, 280 - suffix.length - 1);
  let postText = (headline.length > headlineBudget
    ? headline.slice(0, Math.max(1, headlineBudget - 1)).trimEnd() + "…"
    : headline) + suffix;

  // Remove optional terms before shortening the headline further.
  while (postText.length > 280 && hashtags.length > 1) {
    hashtags.pop();
    suffix = makeSuffix();
    headlineBudget = Math.max(35, 280 - suffix.length - 1);
    postText = (headline.length > headlineBudget
      ? headline.slice(0, Math.max(1, headlineBudget - 1)).trimEnd() + "…"
      : headline) + suffix;
  }
  while (postText.length > 280 && keywords.length) {
    keywords.pop();
    suffix = makeSuffix();
    headlineBudget = Math.max(35, 280 - suffix.length - 1);
    postText = (headline.length > headlineBudget
      ? headline.slice(0, Math.max(1, headlineBudget - 1)).trimEnd() + "…"
      : headline) + suffix;
  }
  if (postText.length > 280) {
    suffix = "\n" + articleUrl;
    headlineBudget = Math.max(1, 280 - suffix.length);
    postText = (headline.length > headlineBudget
      ? headline.slice(0, Math.max(1, headlineBudget - 1)).trimEnd() + "…"
      : headline) + suffix;
  }
  return postText;
}

function oauthPercentEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (character) =>
    "%" + character.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function createXOAuth1AuthorizationHeader(url, credentials) {
  const oauthParameters = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
  };

  const parameterString = Object.entries(oauthParameters)
    .map(([key, value]) => [oauthPercentEncode(key), oauthPercentEncode(value)])
    .sort(([keyA, valueA], [keyB, valueB]) =>
      keyA === keyB ? valueA.localeCompare(valueB) : keyA.localeCompare(keyB),
    )
    .map(([key, value]) => key + "=" + value)
    .join("&");

  const signatureBaseString = [
    "POST",
    oauthPercentEncode(url),
    oauthPercentEncode(parameterString),
  ].join("&");

  const signingKey = oauthPercentEncode(credentials.apiSecret) + "&" + oauthPercentEncode(credentials.accessTokenSecret);
  const signature = createHmac("sha1", signingKey).update(signatureBaseString).digest("base64");

  const authorizationParameters = { ...oauthParameters, oauth_signature: signature };
  const header = Object.entries(authorizationParameters)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => oauthPercentEncode(key) + '="' + oauthPercentEncode(value) + '"')
    .join(", ");

  return "OAuth " + header;
}

async function postArticleToX(article, articleUrl, credentials) {
  const text = buildXPostText(article, articleUrl);
  const endpoint = "https://api.x.com/2/tweets";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: createXOAuth1AuthorizationHeader(endpoint, credentials),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error("X post request failed (HTTP " + response.status + "): " + responseBody.slice(0, 900));
  }

  const result = await response.json();
  const postId = result?.data?.id;
  if (!postId) throw new Error("X did not return a post ID: " + JSON.stringify(result).slice(0, 700));
  console.log("Posted website article to X: https://x.com/i/web/status/" + postId);
  console.log("X post text: " + text);
}

async function publishArticles(articles, supabaseUrl, bearerToken) {
  let successCount = 0;
  const publishedUrls = [];
  const xCredentials = {
    apiKey: process.env.X_API_KEY?.trim() || "",
    apiSecret: process.env.X_API_SECRET?.trim() || "",
    accessToken: process.env.X_ACCESS_TOKEN?.trim() || "",
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET?.trim() || "",
  };
  const xPostingEnabled = Object.values(xCredentials).every(Boolean);

  if (!xPostingEnabled) {
    console.log("X auto-posting is not configured. Add X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN and X_ACCESS_TOKEN_SECRET as GitHub repository secrets to enable it.");
  }

  for (const [index, article] of articles.entries()) {
    const response = await fetchWithRetry(
      supabaseUrl,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + bearerToken,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(article),
      },
      "Supabase publish for article " + (index + 1),
    );
    const responseText = await response.text();
    let result = {};
    try { result = responseText ? JSON.parse(responseText) : {}; } catch { /* keep publishing diagnostics below */ }
    console.log("Published " + (index + 1) + "/" + articles.length + ": " + article.title + " (HTTP " + response.status + ")");
    if (responseText.trim()) console.log("Supabase response: " + responseText.slice(0, 300));

    const inserted = Array.isArray(result.articles) ? result.articles : [];
    for (const saved of inserted) {
      if (!Number.isFinite(Number(saved.id))) {
        console.warn("Website published the article but did not return an ID; skipping its X post.");
        continue;
      }

      const articleUrl = "https://usadailynews.space/article/" + Number(saved.id);
      publishedUrls.push(articleUrl);

      if (xPostingEnabled) {
        try {
          await postArticleToX(article, articleUrl, xCredentials);
        } catch (error) {
          // Keep successful website publication successful even if X is temporarily unavailable.
          console.error("X AUTO-POST FAILED for " + articleUrl + ": " + (error?.message || error));
        }
      }
    }
    successCount += 1;
  }
  return { successCount, publishedUrls };
}
async function submitToIndexNow(urls) {
  const uniqueUrls = [...new Set(urls)].filter((url) => {
    try { return new URL(url).origin === "https://usadailynews.space"; } catch { return false; }
  });
  if (uniqueUrls.length === 0) {
    console.log("IndexNow: no newly published article URLs to submit.");
    return;
  }

  const key = "67ea1ee29eb144169b730af2f82ab722";
  const response = await fetchWithRetry("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: "usadailynews.space",
      key,
      keyLocation: `https://usadailynews.space/${key}.txt`,
      urlList: uniqueUrls,
    }),
  }, "IndexNow URL submission", 3);

  console.log(`IndexNow accepted ${uniqueUrls.length} newly published URL(s) (HTTP ${response.status}).`);
}

async function main() {
  const supabaseUrl = requiredEnv("SUPABASE_FUNCTION_URL");
  const bearerToken = requiredEnv("SUPABASE_BEARER_TOKEN");
  const publishedResponse = await fetchWithRetry(supabaseUrl, { method: "GET", headers: { Authorization: "Bearer " + bearerToken, Accept: "application/json" } }, "Previously published article lookup");
  const publishedData = await publishedResponse.json();
  const publishedArticles = Array.isArray(publishedData?.articles) ? publishedData.articles : [];
  console.log("Loaded " + publishedArticles.length + " previously published articles for duplicate protection.");
  await backfillMissingArticleImages(supabaseUrl, bearerToken);
  if (process.env.IMAGE_BACKFILL_ONLY === "true") {
    console.log("Image-only backfill completed; skipping news generation and publishing.");
    return;
  }
  const geminiApiKey = requiredEnv("GEMINI_API_KEY");
  // Run the full collection and publishing check on every scheduled tick.
  // Duplicate protection below prevents already-published stories from being reused.
  console.log("Starting the scheduled five-minute publishing check.");
  const sourceArticles = await getHeadlines(publishedArticles);
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

  const minimumArticles = positiveInteger(process.env.MIN_ARTICLES, 1);
  console.log(`Gemini generated ${generated.length} result(s); ${articles.length} article(s) passed validation.`);
  if (articles.length < minimumArticles) {
    throw new Error(`Only ${articles.length} article(s) passed validation; at least ${minimumArticles} are required. Nothing will be published this run.`);
  }
  console.log("Article preview:");
  for (const [index, article] of articles.entries()) {
    console.log(`${index + 1}. [${article.category}] ${article.title}`);
  }

  if (!PUBLISH_ENABLED) {
    console.log("DRY RUN ONLY: Publishing is disabled. Nothing was sent to the website.");
    console.log("To publish manually, run the workflow again and check the publish box. To enable scheduled publishing, set repository variable PUBLISH_ENABLED to true after testing.");
    return;
  }

  const { successCount, publishedUrls } = await publishArticles(articles, supabaseUrl, bearerToken);
  console.log(`Finished publishing: ${successCount} article(s) sent to the website.`);
  await submitToIndexNow(publishedUrls);
}

main().catch((error) => {
  console.error(`NEWS AUTOMATION FAILED: ${error?.message || error}`);
  process.exitCode = 1;
});
