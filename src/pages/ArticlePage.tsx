import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { createSeoDescription, createSeoTitle, useSeo } from '@/lib/seo';
import { useMarkdown } from '@/lib/markdown';
import { categoryColor } from '@/lib/categories';
import { formatTimeAgo } from '@/lib/date';
import { SITE_CONFIG } from '@/lib/seo-config';
import type { Article } from '@/types/article';

interface ArticlePageProps {
  id: number;
  onBack: () => void;
}

export function ArticlePage({ id, onBack }: ArticlePageProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setArticle(null);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });

    const client = supabase;
    if (!client) {
      setError('The news database is not configured for this deployment. Check the Cloudflare build variables and redeploy.');
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const { data, error: err } = await client
        .from('articles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else if (!data) {
        setError('Article not found.');
      } else {
        setArticle(data as Article);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const html = useMarkdown(article?.content);
  const color = article ? categoryColor(article.category) : categoryColor('');

  const articleUrl = article ? `${SITE_CONFIG.url}/article/${article.id}` : SITE_CONFIG.url;
  const seoDescription = article ? createSeoDescription(article.seo_description && article.seo_description.length >= 60 ? article.seo_description : article.content, article.title) : undefined;

  const articleSchema = article
    ? {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: article.title,
        articleBody: article.content.replace(/[#*_>]/g, ' ').replace(/\s+/g, ' ').trim(),
        citation: article.source_url && /^https?:\/\//i.test(article.source_url) ? article.source_url : undefined,
        description: seoDescription,
        image: article.image_url || [SITE_CONFIG.ogImage],
        datePublished: article.created_at,
        dateModified: article.created_at,
        inLanguage: 'en-US',
        isAccessibleForFree: true,
        author: { '@type': 'Organization', name: SITE_CONFIG.name, url: SITE_CONFIG.url + '/about' },
        publisher: {
          '@type': 'Organization',
          name: SITE_CONFIG.name,
          logo: { '@type': 'ImageObject', url: SITE_CONFIG.logo },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
        isPartOf: { '@type': 'WebSite', name: SITE_CONFIG.name, url: SITE_CONFIG.url },
        articleSection: article.category,
        keywords: [article.category, 'USA Daily News'],
        url: articleUrl,
      }
    : null;

  useSeo({
    title: article ? createSeoTitle(article.title) : 'USA Daily News',
    description: seoDescription,
    image: article?.image_url || undefined,
    type: 'article',
    url: articleUrl,
    publishedTime: article?.created_at,
    section: article?.category,
    jsonLd: articleSchema ?? undefined,
  });

  const handleShare = async () => {
    if (!article) return;
    const url = `${SITE_CONFIG.url}/article/${article.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: article.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // user dismissed share sheet — no action needed
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-24 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-red-700 font-medium">{error || 'Article not found.'}</p>
        <button onClick={onBack} className="mt-4 text-sm text-blue-700 hover:underline">
          Back to homepage
        </button>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-8" itemScope itemType="https://schema.org/NewsArticle">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to all stories
      </button>

      <span className={`inline-block text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${color.bg} ${color.text}`}>
        {article.category}
      </span>

      <h1 className="mt-3 text-3xl sm:text-4xl font-serif font-bold leading-tight text-gray-900">
        {article.title}
      </h1>

      {article.seo_description && (
        <p className="mt-3 text-lg text-gray-600 font-serif italic leading-relaxed">
          {article.seo_description}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-b border-gray-200 pb-4">
        <div className="text-sm text-gray-500">
          <time dateTime={article.created_at} itemProp="datePublished">
            {new Date(article.created_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' })} UTC
          </time>
          <span className="mx-2">·</span>
          <span>By <a href="/about" className="underline underline-offset-2">USA Daily News</a></span>
          <span className="mx-2">·</span>
          <span>{formatTimeAgo(article.created_at)}</span>
        </div>
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-50 transition-colors"
          aria-label={`Share article: ${article.title}`}
        >
          <Share2 className="h-3.5 w-3.5" />
          {copied ? 'Link copied' : 'Share'}
        </button>
      </div>

      {article.image_url && (
        <figure className="mt-6 -mx-4 sm:mx-0">
          <img
            src={article.image_url}
            alt={article.title}
            width={1600}
            height={900}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="w-full h-auto object-cover sm:rounded-sm"
          />
        </figure>
      )}

      <div
        className="mt-8 prose-serif max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {article.source_url && (
        <div className="mt-10 pt-6 border-t border-gray-200">
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 hover:underline"
          >
            Read the original source report <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </article>
  );
}
