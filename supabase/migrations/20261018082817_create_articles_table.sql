/*
# Create articles table for USA Daily News

1. New Tables
- `articles`
  - `id` (bigint, primary key, auto-increment via identity)
  - `title` (text, not null)
  - `content` (text, markdown body, not null)
  - `category` (text, not null) — e.g. Politics, Tech, Economy, Culture
  - `source_url` (text) — original source link
  - `image_url` (text) — hero image URL
  - `seo_description` (text) — meta description for SEO
  - `created_at` (timestamptz, defaults to now())

2. Security (RLS)
- Enable RLS on `articles`.
- Public SELECT for anon + authenticated (the site is readable by everyone).
- NO insert/update/delete policies for anon/authenticated — writes are
  ONLY permitted via the secure `ingest-article` edge function, which uses
  the service role key and therefore bypasses RLS. This keeps the public
  anon key read-only while still allowing authenticated ingestion through
  the protected server endpoint.

3. Indexes
- `articles_created_at_idx` on `created_at DESC` for newest-first listing.
- `articles_category_idx` on `category` for category filtering.

4. Important Notes
- This is a single-tenant, no-auth public news site. The frontend uses the
  anon key (read-only). New articles are added exclusively through the
  protected webhook endpoint (edge function + service role key + bearer
  token), never through the client.
*/

CREATE TABLE IF NOT EXISTS articles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  source_url text,
  image_url text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Public read access (the whole point of a news site).
DROP POLICY IF EXISTS "public_read_articles" ON articles;
CREATE POLICY "public_read_articles"
ON articles FOR SELECT
TO anon, authenticated
USING (true);

-- No INSERT/UPDATE/DELETE policies: the anon key cannot write.
-- All writes go through the ingest-article edge function (service role key).

CREATE INDEX IF NOT EXISTS articles_created_at_idx ON articles (created_at DESC);
CREATE INDEX IF NOT EXISTS articles_category_idx ON articles (category);
CREATE INDEX IF NOT EXISTS articles_category_created_at_idx ON articles (category, created_at DESC);
