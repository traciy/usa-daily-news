import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSeo } from '@/lib/seo';
import { CATEGORIES, type Category } from '@/lib/categories';
import { SITE_CONFIG } from '@/lib/seo-config';
import type { ArticleSummary } from '@/types/article';
import { ArticleCard } from '@/components/ArticleCard';
import { CategoryFilter } from '@/components/CategoryFilter';
import { PodcastPlayer } from '@/components/PodcastPlayer';
import { SidebarEngagement } from '@/components/SidebarEngagement';

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
      'Email contact@usadailynews.space with the article URL, the detail you believe is incorrect, and reliable supporting information.',
  },
];

export function HomePage({ onOpenArticle, onNavigate, initialCategory }: HomePageProps) {
  const [active, setActive] = useState<Category>(initialCategory ?? 'All');
  const [page, setPage] = useState(1);
  const [totalArticles, setTotalArticles] = useState(0);
  const PAGE_SIZE = 20;
  const categoryDescriptions: Record<Category, string> = {
    All: 'Latest U.S. news, politics, business, technology, culture and sports, with concise, source-attributed coverage and context from USA Daily News.',
    Politics: 'Read politics news, government coverage, policy developments and election updates from USA Daily News.',
    Tech: 'Read technology news, AI developments, innovation and digital industry coverage from USA Daily News.',
    Economy: 'Read business and economy news, markets, jobs, finance and economic policy coverage from USA Daily News.',
    Culture: 'Read culture news, entertainment, arts, society and lifestyle coverage from USA Daily News.',
  };
  useSeo({
    title: active === 'All' ? 'Latest US News: Politics, Business & Tech | USA Daily News' : `${active} News | USA Daily News`,
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
        .select('id, title, category, image_url, seo_description, created_at, source_url', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (active !== 'All') {
        query = query.ilike('category', active);
      }
      const { data, count, error: err } = await query;
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setArticles([]);
        setTotalArticles(0);
      } else {
        setArticles((data ?? []) as ArticleSummary[]);
        setTotalArticles(count ?? 0);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, page]);

  const totalPages = Math.max(1, Math.ceil(totalArticles / PAGE_SIZE));
  const pageNumbers = useMemo<(number | 'ellipsis')[]>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const numbers: (number | 'ellipsis')[] = [1];
    if (page > 4) numbers.push('ellipsis');
    const start = Math.max(2, page - 2);
    const end = Math.min(totalPages - 1, page + 2);
    for (let number = start; number <= end; number += 1) numbers.push(number);
    if (page < totalPages - 3) numbers.push('ellipsis');
    numbers.push(totalPages);
    return numbers;
  }, [page, totalPages]);
  const feature = useMemo(() => articles[0] ?? null, [articles]);
  const rest = useMemo(() => (feature ? articles.slice(1) : articles), [articles, feature]);
  const sidebar = useMemo(() => rest.slice(0, 5), [rest]);
  const grid = useMemo(() => rest.slice(5), [rest]);
  const recommended = useMemo(() => {
    const candidates = articles.slice(6);
    const picks: ArticleSummary[] = [];
    const seenCategories = new Set<string>();
    for (const article of candidates) {
      const category = article.category || 'News';
      if (!seenCategories.has(category)) {
        picks.push(article);
        seenCategories.add(category);
      }
      if (picks.length === 4) break;
    }
    if (picks.length < 4) {
      for (const article of candidates) {
        if (!picks.some((pick) => pick.id === article.id)) picks.push(article);
        if (picks.length === 4) break;
      }
    }
    return picks;
  }, [articles]);

  return (
    <>
      <CategoryFilter active={active} onSelect={(category) => { setActive(category); setPage(1); }} onNavigate={onNavigate} />

      <section className="mx-auto max-w-6xl px-4 py-8" aria-labelledby="latest-heading">
        <h1 id="latest-heading" className="sr-only">
          Latest US News, Politics, Technology & Economy
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="order-1 lg:col-span-2" aria-label="Top stories" aria-busy={loading}>
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

                {totalPages > 1 && (
                  <nav className="mt-10 border-t border-gray-200 pt-6" aria-label="Article pages">
                    <p className="mb-4 text-center text-xs text-gray-500">
                      Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalArticles)} of {totalArticles.toLocaleString()} articles
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page === 1 || loading}
                        className="rounded-sm border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-gray-900 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Previous
                      </button>
                      {pageNumbers.map((number, index) => number === 'ellipsis' ? (
                        <span key={`ellipsis-${index}`} className="px-1 text-gray-500" aria-hidden="true">…</span>
                      ) : (
                        <button
                          key={number}
                          type="button"
                          onClick={() => setPage(number)}
                          disabled={number === page || loading}
                          aria-label={`Page ${number}`}
                          aria-current={number === page ? 'page' : undefined}
                          className={`min-w-10 rounded-sm border px-3 py-2 text-sm font-semibold transition-colors ${number === page ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-700 hover:border-gray-900 hover:text-gray-900'}`}
                        >
                          {number}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page === totalPages || loading}
                        className="rounded-sm border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-gray-900 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </nav>
                )}
              </>
            )}
          </section>

          <aside className="order-2 lg:col-start-3 space-y-4" aria-label="Recent stories and sections" aria-busy={loading}>
            <PodcastPlayer variant="compact" />
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

            <section className="rounded-sm border border-gray-200 bg-white p-4" aria-labelledby="recommended-heading">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
                <div>
                  <h2 id="recommended-heading" className="font-serif font-bold text-gray-900">Recommended Reads</h2>
                  <p className="mt-1 text-xs text-gray-500">More stories across our coverage</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-red-700">For you</span>
              </div>
              {recommended.length > 0 ? (
                <div>
                  {recommended.map((article) => (
                    <div key={article.id} onClick={() => onOpenArticle(article.id)} className="cursor-pointer">
                      <ArticleCard article={article} variant="compact" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">More recommended stories will appear as new articles are published.</p>
              )}
            </section>

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
            <SidebarEngagement onOpenArticle={onOpenArticle} />
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
