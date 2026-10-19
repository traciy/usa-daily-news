import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSeo } from '@/lib/seo';
import { CATEGORIES, type Category } from '@/lib/categories';
import type { ArticleSummary } from '@/types/article';
import { ArticleCard } from '@/components/ArticleCard';
import { CategoryFilter } from '@/components/CategoryFilter';

interface HomePageProps {
  onOpenArticle: (id: number) => void;
}

export function HomePage({ onOpenArticle }: HomePageProps) {
  useSeo({
    title: 'USA Daily News — Truth, Clarity, Coverage',
    description:
      'Independent American journalism covering Politics, Tech, Economy, and Culture. Fresh stories, every day.',
    type: 'website',
  });

  const [active, setActive] = useState<Category>('All');
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      let query = supabase
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
    <div>
      <CategoryFilter active={active} onSelect={setActive} />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content column */}
          <section className="lg:col-span-2 order-2 lg:order-1">
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
          <aside className="lg:col-span-1 order-1 lg:order-2 space-y-8">
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
              <h3 className="font-serif font-bold text-gray-900">Sections</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <li key={c}>
                    <button
                      onClick={() => setActive(c)}
                      className="text-gray-700 hover:text-gray-900 hover:underline"
                    >
                      {c}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
