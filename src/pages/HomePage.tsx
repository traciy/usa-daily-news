import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSeo } from '@/lib/seo';
import { CATEGORIES, type Category } from '@/lib/categories';
import { SITE_CONFIG } from '@/lib/seo-config';
import type { ArticleSummary } from '@/types/article';
import { ArticleCard } from '@/components/ArticleCard';
import { CategoryFilter } from '@/components/CategoryFilter';

interface HomePageProps {
  onOpenArticle: (id: number) => void;
  onNavigate: (path: string) => void;
  initialCategory?: Category;
}

const FAQ_ENTRIES = [
  {
    question: 'How is content prepared for USA Daily News?',
    answer:
      'Digital tools and AI-assisted processes may help discover, organize, and prepare news summaries. Articles may summarize reporting published by other outlets, with source links provided when available.',
  },
  {
    question: 'Is every article original reporting?',
    answer:
      'No. Some articles summarize or discuss reporting published by other outlets. USA Daily News aims to identify and link to source material when available.',
  },
  {
    question: 'How can I report an error?',
    answer:
      'Email info.luwigang254@gmail.com with the article URL, the detail you believe is incorrect, and reliable supporting information.',
  },
];

export function HomePage({ onOpenArticle, onNavigate, initialCategory }: HomePageProps) {
  const [active, setActive] = useState<Category>(initialCategory ?? 'All');
  const categoryDescriptions: Record<Category, string> = {
    All: 'Digital news coverage and source-attributed summaries across US and international affairs, politics, business, technology, culture, weather and sports.',
    Politics: 'Read politics news, government coverage, policy developments and election updates from USA Daily News.',
    Tech: 'Read technology news, AI developments, innovation and digital industry coverage from USA Daily News.',
    Economy: 'Read business and economy news, markets, jobs, finance and economic policy coverage from USA Daily News.',
    Culture: 'Read culture news, entertainment, arts, society and lifestyle coverage from USA Daily News.',
  };
  useSeo({
    title: active === 'All' ? 'Latest US News, Politics, Technology & Economy | USA Daily News' : `${active} News | USA Daily News`,
    description: categoryDescriptions[active],
    type: 'website',
    url: SITE_CONFIG.url + (window.location.pathname === '/' ? '/' : window.location.pathname),
  });
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
          Latest US News, Politics, Technology & Economy
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 order-2 lg:order-1" aria-label="Top stories" aria-busy={loading}>
            {loading && (
              <div className="space-y-6" aria-label="Loading latest stories">
                <div className="overflow-hidden rounded-sm border border-gray-200 bg-white">
                  <div className="aspect-[16/9] animate-pulse bg-gray-200" />
                  <div className="space-y-3 p-5 sm:p-7">
                    <div className="h-5 w-20 rounded bg-gray-200 animate-pulse" />
                    <div className="h-8 w-full rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-4/5 rounded bg-gray-200 animate-pulse" />
                    <div className="h-3 w-28 rounded bg-gray-200 animate-pulse" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="overflow-hidden rounded-sm border border-gray-200 bg-white">
                      <div className="aspect-[16/10] animate-pulse bg-gray-200" />
                      <div className="space-y-3 p-4">
                        <div className="h-4 w-16 rounded bg-gray-200 animate-pulse" />
                        <div className="h-5 w-full rounded bg-gray-200 animate-pulse" />
                        <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse" />
                      </div>
                    </div>
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

          <aside className="lg:col-span-1 order-1 lg:order-2 space-y-8" aria-label="Recent stories and sections" aria-busy={loading}>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 border-b-2 border-gray-900 pb-2 mb-4">
                Most Recent
              </h2>
              {loading && <div className="space-y-3" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="flex gap-3 border-b border-gray-200 py-3">
                  <div className="h-20 w-20 shrink-0 animate-pulse rounded-sm bg-gray-200" />
                  <div className="min-w-0 flex-1 space-y-2 py-1"><div className="h-3 w-16 rounded bg-gray-200 animate-pulse" /><div className="h-4 w-full rounded bg-gray-200 animate-pulse" /><div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" /></div>
                </div>)}
              </div>}
              {!loading && articles.slice(0, 6).map((a) => (
                <div key={a.id} onClick={() => onOpenArticle(a.id)} className="cursor-pointer">
                  <ArticleCard article={a} variant="compact" />
                </div>
              ))}
            </div>

            <div className="min-h-[220px] p-5 bg-gray-50 border border-gray-200 rounded-sm">
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

      <section className="home-deferred-section mx-auto max-w-3xl px-4 py-12" aria-labelledby="faq-heading">
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

      <section className="home-deferred-section bg-gray-50 border-t border-gray-200" aria-labelledby="about-heading">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <h2 id="about-heading" className="text-2xl font-serif font-bold text-gray-900 mb-4">
            About USA Daily News
          </h2>
          <p className="text-gray-700 leading-relaxed">
            USA Daily News helps readers follow current events across politics, technology, the economy,
            culture, weather and sports. We use digital tools and AI-assisted processes to prepare
            clear news summaries based on reporting from other publishers and available source
            material. Where source information is available, we link to the original report so
            readers can review it directly. We aim to correct material inaccuracies when reliable
            evidence is brought to our attention.
          </p>
          <button
            onClick={() => onNavigate('/about')}
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-900 transition-colors"
          >
            Learn more about us <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </>
  );
}
