import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

  const xmlHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: xmlHeaders });
  }

  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: xmlHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      const errXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>`;
      return new Response(errXml, { status: 200, headers: xmlHeaders });
    }

    const origin = 'https://bolt.host';
    const lastmod = new Date().toISOString().split('T')[0];

    const urls: string[] = [];

    // Homepage
    urls.push(
      `  <url>\n    <loc>${escapeXml(origin)}/</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`
    );

    // Article pages
    for (const article of articles ?? []) {
      const articleLastmod = toIsoDate(article.created_at) ?? lastmod;
      const loc = `${origin}/#/article/${article.id}`;
      urls.push(
        `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${articleLastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: xmlHeaders,
    });
  } catch (err) {
    const errXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>`;
    return new Response(errXml, { status: 200, headers: xmlHeaders });
  }
});
