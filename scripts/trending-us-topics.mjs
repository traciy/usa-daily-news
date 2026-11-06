import { mkdir, writeFile } from "node:fs/promises";

const FEED = "https://trends.google.com/trending/rss?geo=US";
const SITEMAP = process.env.SITEMAP_URL || "https://usadailynews.space/sitemap.xml";
const OUT = "reports/us-trends";
// Check only the newest 20 article URLs. This keeps duplicate detection useful
// while avoiding hundreds of article-page requests on frequent automation runs.
const MAX_ARTICLE_PAGES = 10;
const ARTICLE_FETCH_CONCURRENCY = 3;
const CATEGORY_RULES = {
  "US Politics": /\b(president|presidential|white house|congress|senate|house of representatives|election|vote|voting|democrat|republican|trump|biden|harris|governor|supreme court|political|politics|immigration|border|fbi|doj|justice department|state department|rubio|melania|dhillon)\b/i,
  Sports: /\b(nba|nfl|mlb|nhl|wnba|ncaa|soccer|football|basketball|baseball|hockey|tennis|golf|formula 1|f1|ufc|wwe|olympics|champions league|premier league|la liga|serie a|bundesliga|milan|match| vs |game|playoff|playoffs|coach|quarterback|goal|tournament|athlete|team)\b/i,
  Entertainment: /\b(actor|actress|singer|music|album|movie|film|celebrity|hollywood|netflix|disney|hbo|grammy|oscar|emmy|concert|tour|tv|television|series|reality show|watts|nash|skarsgård|skarsgard|buse)\b/i,
  Business: /\b(stock|stocks|market|markets|earnings|company|ceo|business|economy|economic|inflation|jobs report|unemployment|tariff|tariffs|trade|bank|banking|federal reserve|fed|ipo|layoff|layoffs|merger|oil prices|gas prices)\b/i,
  Technology: /\b(ai|artificial intelligence|openai|google|apple|microsoft|meta|nvidia|amazon|tesla|spacex|iphone|android|cybersecurity|software|chip|chips|semiconductor|robot|robotics|app|technology|tech)\b/i,
  "US News": /\b(weather|storm|hurricane|tornado|wildfire|earthquake|shooting|crash|accident|school|hospital|court|police|crime|missing|rescue|disaster|cdc|health| nasa |space launch)\b/i
};
const STOP = new Set(["the", "and", "for", "with", "from", "what", "when", "where", "who", "why", "how", "news", "latest", "today"]);
function decode(s = "") {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).trim();
}
function value(xml, tag) {
  const m = xml.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i"));
  return m ? decode(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")) : "";
}
async function get(url, label) {
  const r = await fetch(url, { headers: { "user-agent": "USA-Daily-News-Trend-Discovery/2.0", accept: "application/xml, text/xml, */*" }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw Error(label + " HTTP " + r.status);
  return r.text();
}
function parse(xml) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((m, i) => {
    const x = m[1];
    const related = [...x.matchAll(/<ht:news_item(?:\s[^>]*)?>([\s\S]*?)<\/ht:news_item>/gi)].map(n => ({ title: value(n[1], "ht:news_item_title"), source: value(n[1], "ht:news_item_source"), url: value(n[1], "ht:news_item_url") })).filter(n => n.title && /^https?:\/\//i.test(n.url));
    const topic = value(x, "title");
    return { rank: i + 1, topic, traffic: value(x, "ht:approx_traffic"), started: value(x, "pubDate"), googleUrl: "https://trends.google.com/trends/explore?geo=US&q=" + encodeURIComponent(topic), related: related.slice(0, 5) };
  }).filter(x => x.topic);
}
function words(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter(w => w.length > 2 && !STOP.has(w));
}
async function recentArticles() {
  try {
    const xml = await get(SITEMAP, "Sitemap");
    const urls = [...xml.matchAll(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/gi)].map(m => decode(m[1])).filter(u => /^https?:\/\//i.test(u) && /\/article\/\d+/.test(u)).slice(0, MAX_ARTICLE_PAGES);
    const results = []; let cursor = 0;
    async function worker() {
      while (cursor < urls.length) {
        const url = urls[cursor++];
        try {
          const html = await get(url, "Article page");
          const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
          if (m) { const title = decode(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")); if (title) results.push({ url, title }); }
        } catch (e) { console.warn("Skipping article page " + url + ": " + e.message); }
      }
    }
    await Promise.all(Array.from({ length: ARTICLE_FETCH_CONCURRENCY }, () => worker()));
    return results;
  } catch (e) { console.warn("Recent article comparison unavailable: " + e.message); return []; }
}
function coverage(topic, articles) {
  const terms = words(topic);
  if (!terms.length || !articles.length) return { status: "Unable to compare", matches: [] };
  const matches = articles.map(article => {
    const titleTerms = new Set(words(article.title));
    const overlap = terms.filter(term => titleTerms.has(term));
    return { url: article.url, title: article.title, count: overlap.length, score: overlap.length / terms.length };
  }).filter(x => x.count >= Math.min(2, terms.length)).sort((a, b) => b.score - a.score).slice(0, 3);
  return { status: matches.length ? "Possibly covered" : "No obvious matching article found", matches };
}
function trafficPoints(traffic = "") {
  const n = Number(String(traffic).replace(/[^0-9]/g, ""));
  if (!n) return 5;
  if (n >= 100000) return 40;
  if (n >= 50000) return 35;
  if (n >= 20000) return 30;
  if (n >= 10000) return 25;
  if (n >= 5000) return 20;
  if (n >= 2000) return 15;
  if (n >= 1000) return 12;
  if (n >= 500) return 8;
  return 4;
}
function editorialAssessment(t, articleCount) {
  const evidence = t.related.map(n => n.title).join(" ");
  const combined = t.topic + " " + evidence;
  const category = Object.entries(CATEGORY_RULES).find(([, pattern]) => pattern.test(combined))?.[0] || "Unclassified";
  const relatedCount = t.related.length;
  const coverageFound = t.coverage.status === "Possibly covered";
  const evidenceScore = Math.min(20, relatedCount * 5);
  const relevanceScore = category === "Unclassified" ? 0 : 25;
  const coverageScore = coverageFound ? 0 : articleCount ? 20 : 8;
  const score = Math.min(100, trafficPoints(t.traffic) + evidenceScore + relevanceScore + coverageScore);
  const filtered = category === "Unclassified" || relatedCount === 0;
  const priority = filtered ? "Filter — needs human review" : score >= 75 ? "High" : score >= 55 ? "Medium" : "Low";
  const topic = t.topic;
  const headlines = filtered ? [] : [
    "What to know about " + topic + " as it trends across the US",
    topic + ": The latest developments and what happens next",
    "Why " + topic + " is trending — key details explained"
  ];
  const keywords = filtered ? [] : [...new Set([topic, category, ...words(topic), ...words(evidence).slice(0, 8)])].slice(0, 12);
  return { category, priority, score, filtered, relatedSourceCount: relatedCount, hasCredibleContext: relatedCount > 0, editorialDecision: filtered ? "Do not auto-publish. Check whether this is a genuine, relevant news story." : coverageFound ? "Review existing coverage first; update or add a genuinely new angle." : "Potential coverage gap. Verify with reliable sources before drafting.", headlineIdeas: headlines, suggestedKeywords: keywords };
}
function report(d) {
  const lines = ["# USA Daily News — US Trending Topics", "", "Source: Google's public US Trending Now RSS feed. Traffic figures are approximate buckets, not exact counts. Trend searches are signals of interest, not verified news.", "", "Collected: " + d.collectedAt, "Topics returned: " + d.trends.length, "Recent article titles checked: " + d.recentArticlesChecked, "", "## Editorial shortlist", ""];
  const shortlisted = d.trends.filter(t => !t.editorial.filtered).sort((a, b) => b.editorial.score - a.editorial.score);
  if (!shortlisted.length) lines.push("No trends currently meet the editorial evidence threshold. Review the filtered list manually.");
  for (const t of shortlisted) {
    lines.push("### " + t.topic, "- **Priority:** " + t.editorial.priority + " (" + t.editorial.score + "/100)", "- **Category:** " + t.editorial.category, "- **Approx. search traffic:** " + (t.traffic || "Not supplied"), "- **Coverage check:** " + t.coverage.status, "- **Decision:** " + t.editorial.editorialDecision, "- **Headline ideas:**");
    for (const h of t.editorial.headlineIdeas) lines.push("  - " + h);
    lines.push("- **Suggested keywords:** " + t.editorial.suggestedKeywords.join(", "));
    for (const m of t.coverage.matches) lines.push("- Possible existing article: [" + m.title + "](" + m.url + ")");
    if (t.related.length) { lines.push("- **Related reporting to verify:**"); for (const n of t.related) lines.push("  - [" + n.title.replace(/[\[\]]/g, "") + "](" + n.url + ")" + (n.source ? " — " + n.source : "")); }
    lines.push("");
  }
  lines.push("## Filtered / manual review", "");
  for (const t of d.trends.filter(t => t.editorial.filtered)) lines.push("- **" + t.topic + "** — " + t.editorial.editorialDecision + " Related news links: " + t.related.length + ".");
  lines.push("", "## Scoring notes", "", "- Scores combine approximate traffic, related-news context, category relevance, and whether the site appears to have covered the topic already.", "- High: 75–100; Medium: 55–74; Low: below 55.", "- Unclassified topics or topics without related news are held for human review, not treated as publishable opportunities.", "- Headline ideas are prompts only. Verify the underlying facts and add a genuinely new angle before publishing.");
  return lines.join("\n") + "\n";
}
const trends = parse(await get(FEED, "Google Trends US RSS"));
if (!trends.length) throw Error("Google Trends returned no parseable topics.");
const articles = await recentArticles();
for (const t of trends) { t.coverage = coverage(t.topic, articles); t.editorial = editorialAssessment(t, articles.length); }
const data = { collectedAt: new Date().toISOString(), source: FEED, sitemapSource: SITEMAP, recentArticlesChecked: articles.length, scoring: { high: "75–100", medium: "55–74", low: "below 55" }, trends };
await mkdir(OUT, { recursive: true });
await writeFile(OUT + "/trending-us-topics.json", JSON.stringify(data, null, 2) + "\n");
await writeFile(OUT + "/trending-us-topics.md", report(data));
console.log("Collected " + trends.length + " US trends; compared " + articles.length + " article titles.");
for (const t of trends) console.log("#" + t.rank + " " + t.topic + " | " + t.editorial.category + " | " + t.editorial.priority + " | " + t.editorial.score + "/100 | " + t.coverage.status);
