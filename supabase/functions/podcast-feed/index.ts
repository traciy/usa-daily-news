// Public podcast RSS proxy + parser for USA Daily News.
//
// URL: https://<project>.supabase.co/functions/v1/podcast-feed
//
// Fetches the Spreaker RSS feed server-side (browsers can't due to CORS),
// parses it with a DOMParser-style regex pass, and returns JSON episodes:
//   { episodes: [{ title, description, audioUrl, duration, pubDate, image, link }] }
//
// No auth — this is public podcast metadata.

const FEED_URL = "https://www.spreaker.com/show/7171820/episodes/feed";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Client-Info, Apikey",
};

interface Episode {
  title: string;
  description: string;
  audioUrl: string;
  duration: number; // seconds
  pubDate: string;
  image: string | null;
  link: string | null;
}

function textBetween(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(xml);
  return m ? m[1].trim() : "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

function parseFeed(xml: string): { title: string; episodes: Episode[] } {
  const showTitle = decodeEntities(textBetween(xml, "title"));

  // Split into <item> blocks.
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const episodes: Episode[] = items.slice(0, 12).map((raw) => {
    const title = decodeEntities(textBetween(raw, "title"));
    const description = decodeEntities(textBetween(raw, "description"));
    const pubDate = decodeEntities(textBetween(raw, "pubDate"));
    const link = decodeEntities(textBetween(raw, "link")) || null;

    // enclosure: <enclosure url="..." length="..." type="audio/mpeg" />
    const encMatch = /<enclosure[^>]*url="([^"]+)"/i.exec(raw);
    const audioUrl = encMatch ? encMatch[1] : "";

    // itunes:duration — seconds OR HH:MM:SS
    const durRaw = decodeEntities(textBetween(raw, "itunes:duration"));
    let duration = 0;
    if (/^\d+$/.test(durRaw)) {
      duration = parseInt(durRaw, 10);
    } else if (/^\d+:\d+/.test(durRaw)) {
      const parts = durRaw.split(":").map((n) => parseInt(n, 10));
      if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) duration = parts[0] * 60 + parts[1];
    }

    // image
    const imgMatch = /<itunes:image[^>]*href="([^"]+)"/i.exec(raw)
      || /<image[^>]*url="([^"]+)"/i.exec(raw);
    const image = imgMatch ? imgMatch[1] : null;

    return {
      title: stripTags(title) || "Untitled Episode",
      description: stripTags(description).slice(0, 280),
      audioUrl,
      duration,
      pubDate,
      image,
      link,
    };
  }).filter((e) => e.audioUrl);

  return { title: showTitle, episodes };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use GET." }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "USA-Daily-News-Podcast/1.0" },
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Feed fetch failed: ${res.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const xml = await res.text();
    const parsed = parseFeed(xml);

    // Cache at the edge for 10 minutes.
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Feed parse failed.", details: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
