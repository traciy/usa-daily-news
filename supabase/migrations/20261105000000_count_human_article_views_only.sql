ALTER TABLE public.article_views
  ADD COLUMN IF NOT EXISTS is_human boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.article_trending AS
SELECT
  a.id,
  a.title,
  a.category,
  a.image_url,
  a.seo_description,
  a.created_at,
  a.source_url,
  count(v.id)::integer AS view_count
FROM public.articles a
JOIN public.article_views v ON v.article_id = a.id
WHERE v.viewed_on >= ((timezone('utc'::text, now()))::date - 6)
  AND v.is_human IS TRUE
GROUP BY a.id
ORDER BY count(v.id) DESC, max(v.created_at) DESC
LIMIT 12;
