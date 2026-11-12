import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSeo } from '@/lib/seo';
import { SITE_CONFIG } from '@/lib/seo-config';
import type { ArticleSummary } from '@/types/article';

interface ArchivePageProps {
  page: number;
  onOpenArticle: (id: number) => void;
  onNavigate: (path: string) => void;
}

const PAGE_SIZE = 50;

export function ArchivePage({ page, onOpenArticle, onNavigate }: ArchivePageProps) {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const safePage = Math.max(1, Math.floor(page || 1));
  const archivePath = safePage === 1 ? '/archive' : '/archive/' + safePage;

  useSeo({
    title: safePage === 1 ? 'News Archive | USA Daily News' : 'News Archive — Page ' + safePage + ' | USA Daily News',
    description: 'Browse the USA Daily News archive by date, with direct links to published articles on US politics, business, technology, culture and sports.',
    type: 'website',
    url: SITE_CONFIG.url + archivePath,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (!supabase) {
      setArticles([]);
      setTotalArticles(0);
      setError('The news archive is not available because the news database is not configured.');
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const start = (safePage - 1) * PAGE_SIZE;
      const { data, count, error: queryError } = await supabase
        .from('articles')
        .select('id, title, category, image_url, seo_description, created_at, source_url', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, start + PAGE_SIZE - 1);

      if (cancelled) return;
      if (queryError) {
        setArticles([]);
        setTotalArticles(0);
        setError(queryError.message);
      } else {
        setArticles((data ?? []) as ArticleSummary[]);
        setTotalArticles(count ?? 0);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [safePage]);

  const totalPages = Math.max(1, Math.ceil(totalArticles / PAGE_SIZE));
  const pageNumbers = useMemo<(number | 'ellipsis')[]>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const numbers: (number | 'ellipsis')[] = [1];
    if (safePage > 4) numbers.push('ellipsis');
    const start = Math.max(2, safePage - 2);
    const end = Math.min(totalPages - 1, safePage + 2);
    for (let number = start; number <= end; number += 1) numbers.push(number);
    if (safePage < totalPages - 3) numbers.push('ellipsis');
    numbers.push(totalPages);
    return numbers;
  }, [safePage, totalPages]);

  const pageHref = (number: number) => number === 1 ? '/archive' : '/archive/' + number;
  const openArticle = (event: React.MouseEvent<HTMLAnchorElement>, id: number) => {
    event.preventDefault();
    onOpenArticle(id);
  };
  const goToPage = (event: React.MouseEvent<HTMLAnchorElement>, nextPage: number) => {
    event.preventDefault();
    onNavigate(pageHref(nextPage));
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
        <a href="/" className="underline underline-offset-2">Home</a>
        <span className="mx-2">/</span>
        <span aria-current="page">News archive</span>
      </nav>

      <header className="border-b-2 border-gray-900 pb-5">
        <h1 className="font-serif text-3xl font-bold text-gray-900">News Archive</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
          Browse published USA Daily News articles, from the latest coverage to earlier reporting.
        </p>
        {!loading && !error && (
          <p className="mt-3 text-xs text-gray-500">
            Showing {totalArticles === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, totalArticles)} of {totalArticles.toLocaleString()} articles
          </p>
        )}
      </header>

      {loading && (
        <p className="py-10 text-center text-sm text-gray-500" role="status">Loading the news archive…</p>
      )}

      {error && (
        <div className="py-10 text-center">
          <p className="font-medium text-red-700">The archive could not be loaded.</p>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
        </div>
      )}

      {!loading && !error && articles.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-500">No articles are available in this archive page.</p>
      )}

      {!loading && !error && articles.length > 0 && (
        <>
          <ol className="mt-6 grid list-decimal gap-4 pl-5">
            {articles.map((article) => (
              <li key={article.id} className="rounded-sm border border-gray-200 bg-white p-4">
                <article>
                  <h2 className="font-serif text-lg font-bold leading-snug">
                    <a
                      href={'/article/' + article.id}
                      onClick={(event) => openArticle(event, article.id)}
                      className="text-gray-900 underline-offset-2 hover:underline"
                    >
                      {article.title}
                    </a>
                  </h2>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {article.category} · {new Date(article.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                  </p>
                  {article.seo_description && (
                    <p className="mt-2 text-sm leading-relaxed text-gray-700">{article.seo_description}</p>
                  )}
                </article>
              </li>
            ))}
          </ol>

          <nav aria-label="Archive pages" className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-gray-200 pt-6 text-sm">
            {safePage > 1 && (
              <a
                href={pageHref(safePage - 1)}
                onClick={(event) => goToPage(event, safePage - 1)}
                rel="prev"
                className="rounded-sm border border-gray-300 px-3 py-2 font-semibold text-gray-700 hover:border-gray-900"
              >
                Previous
              </a>
            )}
            {pageNumbers.map((number, index) => number === 'ellipsis' ? (
              <span key={'ellipsis-' + index} aria-hidden="true" className="px-1 text-gray-500">…</span>
            ) : number === safePage ? (
              <span key={number} aria-current="page" className="rounded-sm border border-gray-900 bg-gray-900 px-3 py-2 font-semibold text-white">
                {number}
              </span>
            ) : (
              <a
                key={number}
                href={pageHref(number)}
                onClick={(event) => goToPage(event, number)}
                className="rounded-sm border border-gray-300 px-3 py-2 font-semibold text-gray-700 hover:border-gray-900 hover:text-gray-900"
              >
                {number}
              </a>
            ))}
            {safePage < totalPages && (
              <a
                href={pageHref(safePage + 1)}
                onClick={(event) => goToPage(event, safePage + 1)}
                rel="next"
                className="rounded-sm border border-gray-300 px-3 py-2 font-semibold text-gray-700 hover:border-gray-900"
              >
                Next
              </a>
            )}
          </nav>
        </>
      )}
    </main>
  );
}
