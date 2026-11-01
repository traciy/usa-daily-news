import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSeo } from '@/lib/seo';
import { CATEGORIES, type Category } from '@/lib/categories';
import { SITE_CONFIG, ORGANIZATION_SCHEMA, WEBSITE_SCHEMA, FAQ_SCHEMA } from '@/lib/seo-config';
import type { ArticleSummary } from '@/types/article';
import { ArticleCard } from '@/components/ArticleCard';
import { CategoryFilter } from '@/components/CategoryFilter';

interface HomePageProps {
  onOpenArticle: (id: number) => void;
  onNavigate: (path: string) => void;
}

const FAQ_ENTRIES = [
  {
    question: 'What is USA Daily News?',
    answer:
      'USA Daily News is an independent American news outlet covering Politics, Technology, Economy, and Culture. We publish fresh, verified stories every day with clarity, accuracy, and coverage you can trust.',
  },
  {
    question: 'What topics does USA Daily News cover?',
    answer:
      'We cover four core sections: Politics, Tech, Economy, and Culture. Each section features daily original reporting on American policy, innovation, markets, and society — written in plain language.',
  },
  {
    question: 'How often is USA Daily News updated?',
    answer:
      'New stories are published every day across all four sections. Our editorial team monitors developing stories in real time, so readers always have the latest reporting on American news.',
  },
  {
    question: 'Is USA Daily News independent journalism?',
    answer:
      'Yes. USA Daily News is fully independent and not owned by a political party, corporation, or foreign entity. Our reporting is guided by facts, sourced verification, and plain-language truth.',
  },
];

export function HomePage({ onOpenArticle, onNavigate }: HomePageProps) {
  useSeo({
    title: 'USA Daily News — US Politics, Tech, Economy & Culture',
    description:
      'Independent American journalism covering Politics, Tech, Economy, and Culture. Fresh stories every day with clarity and coverage you can trust.',
    type: 'website',
    url: SITE_CONFIG.url,
    jsonLd: [ORGANIZATION_SCHEMA, WEBSITE_SCHEMA, FAQ_SCHEMA],
  });

  const [active, setActive] = useState<Category>('All');
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const client = supabase;
    if (!client) {
      setError('The news database is not configured for this deployment. Check the Cloudflare build variables and redeploy.');
      setArticles([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      let query = client
        .from('articles')
        .select('id, title, category, image_url, seo_description, created_at, source_url')
        .order('created_at', { ascending: false })
        .limit(24);
      if (active !== 'All') {
        query = query.ilike('category', active);
      }
      const { data, error: err } = await query;
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setArticles([]);
      } else {
        setArticles((data ?? []) as ArticleSummary[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  const feature = useMemo(() => articles[0] ?? null, [articles]);
  const rest = useMemo(() => (feature ? articles.slice(1) : articles), [articles, feature]);
  const sidebar = useMemo(() => rest.slice(0, 5), [rest]);
  const grid = useMemo(() => rest.slice(5), [rest]);

  return (
    <>
      <CategoryFilter active={active} onSelect={setActive} onNavigate={onNavigate} />

      <section className="mx-auto max-w-6xl px-4 py-8" aria-labelledby="latest-heading">
        <h1 id="latest-heading" className="sr-only">
          USA Daily News — Latest Stories
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content column */}
          <section className="lg:col-span-2 order-2 lg:order-1" aria-label="Top stories">
            {loading && (
              <div className="space-y-6 animate-pulse">
                <div className="h-80 bg-gray-200 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-64 bg-gray-200 rounded" />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="text-center py-20">
                <p className="text-red-700 font-medium">Couldn't load stories right now.</p>
                <p className="text-sm text-gray-500 mt-1">{error}</p>
              </div>
            )}

            {!loading && !error && articles.length === 0 && (
              <div className="text-center py-20">
                <p className="text-gray-700 font-serif text-lg">
                  {active === 'All'
                    ? 'No stories have been published yet.'
                    : `No stories in ${active} yet.`}
                </p>
                <p className="text-sm text-gray-500 mt-2">Check back soon.</p>
              </div>
            )}

            {!loading && !error && articles.length > 0 && (
              <>
                {feature && (
                  <div className="mb-10">
                    <div onClick={() => onOpenArticle(feature.id)} className="cursor-pointer">
                      <ArticleCard article={feature} variant="feature" />
                    </div>
                  </div>
                )}

                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 border-b-2 border-gray-900 pb-2 mb-4">
                  {active === 'All' ? 'Latest Stories' : active}
                </h2>
                {sidebar.length > 0 && (
                  <div className="mb-6">
                    {sidebar.map((a) => (
                      <div key={a.id} onClick={() => onOpenArticle(a.id)} className="cursor-pointer">
                        <ArticleCard article={a} variant="compact" />
                      </div>
                    ))}
                  </div>
                )}
                {grid.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {grid.map((a) => (
                      <div key={a.id} onClick={() => onOpenArticle(a.id)} className="cursor-pointer">
                        <ArticleCard article={a} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Sidebar — always visible */}
          <aside className="lg:col-span-1 order-1 lg:order-2 space-y-8" aria-label="Recent stories and sections">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 border-b-2 border-gray-900 pb-2 mb-4">
                Most Recent
              </h2>
              {articles.slice(0, 6).map((a) => (
                <div key={a.id} onClick={() => onOpenArticle(a.id)} className="cursor-pointer">
                  <ArticleCard article={a} variant="compact" />
                </div>
              ))}
            </div>

            <div className="p-5 bg-gray-50 border border-gray-200 rounded-sm">
              <h2 className="font-serif font-bold text-gray-900">Sections</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <li key={c}>
                    <button
                      onClick={() => setActive(c)}
                      className="text-gray-700 hover:text-gray-900 hover:underline"
                      aria-pressed={c === active}
                    >
                      {c}
                    </button>
                  </li>
                ))}
                <li>
                  <button onClick={() => onNavigate('/football')} className="text-gray-700 hover:text-gray-900 hover:underline">
                    Sports
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/weather')} className="text-gray-700 hover:text-gray-900 hover:underline">
                    Weather
                  </button>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      {/* FAQ — Answer-First layout targeting featured snippets / AI Overview */}
      <section className="mx-auto max-w-3xl px-4 py-12" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-2xl font-serif font-bold text-gray-900 mb-6 text-center">
          Frequently Asked Questions
        </h2>
        <ol className="space-y-6">
          {FAQ_ENTRIES.map((entry) => (
            <li key={entry.question} className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-serif font-bold text-gray-900 mb-2">
                {entry.question}
              </h3>
              <p className="text-gray-700 leading-relaxed">{entry.answer}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* About blurb — Answer-First for LLM clarity */}
      <section className="bg-gray-50 border-t border-gray-200" aria-labelledby="about-heading">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <h2 id="about-heading" className="text-2xl font-serif font-bold text-gray-900 mb-4">
            About USA Daily News
          </h2>
          <p className="text-gray-700 leading-relaxed">
            USA Daily News delivers independent American journalism across Politics, Tech,
            Economy, and Culture. Our editors publish verified, plain-language reporting every day
            so readers stay informed without the noise.
          </p>
          <button
            onClick={() => onOpenArticle(0)}
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-900 transition-colors"
          >
            Read our latest coverage <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </>
  );
}
