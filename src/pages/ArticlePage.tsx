import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { createSeoDescription, createSeoTitle, useSeo } from '@/lib/seo';
import { useMarkdown } from '@/lib/markdown';
import { categoryColor } from '@/lib/categories';
import { formatTimeAgo } from '@/lib/date';
import { SITE_CONFIG } from '@/lib/seo-config';
import { safeHttpUrl } from '@/lib/safe-url';
import type { Article, ArticleSummary } from '@/types/article';
import { ArticleCard } from '@/components/ArticleCard';

interface ArticlePageProps {
  id: number;
  onBack: () => void;
}

export function ArticlePage({ id, onBack }: ArticlePageProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [recommended, setRecommended] = useState<ArticleSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setArticle(null);
    setRecommended([]);
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
        const currentArticle = data as Article;
        setArticle(currentArticle);
        // Trending Now is intended to reflect readers, not search/social crawlers.
        const userAgent = window.navigator.userAgent || '';
        const isAutomatedVisitor =
          window.navigator.webdriver === true ||
          /bot|crawler|spider|headless|preview|slurp|facebookexternalhit|twitterbot|linkedinbot|discordbot|slackbot|telegrambot|whatsapp|curl|wget|python-requests/i.test(userAgent);

        if (!isAutomatedVisitor) {
          try {
            const visitorKey = 'usadailynews-article-reader';
            let visitorId = window.localStorage.getItem(visitorKey);
            if (!visitorId) {
              visitorId = window.crypto.randomUUID();
              window.localStorage.setItem(visitorKey, visitorId);
            }
            const { error: trackingError } = await client.from('article_views').upsert(
              { article_id: currentArticle.id, visitor_id: visitorId, is_human: true },
              { onConflict: 'article_id,viewed_on,visitor_id', ignoreDuplicates: true },
            );
            if (trackingError) {
              console.warn('USA Daily News article view could not be recorded:', trackingError.message);
            }
          } catch (trackingError) {
            console.warn('USA Daily News article view tracking is unavailable:', trackingError);
          }
        }
        const { data: suggestions } = await client
          .from('articles')
          .select('id, title, category, image_url, seo_description, created_at, source_url')
          .neq('id', id)
          .order('created_at', { ascending: false })
          .limit(12);
        if (!cancelled) {
          const candidates = (suggestions ?? []) as ArticleSummary[];
          const sameCategory = candidates.filter((item) => item.category?.toLowerCase() === currentArticle.category?.toLowerCase());
          const recent = candidates.filter((item) => item.category?.toLowerCase() !== currentArticle.category?.toLowerCase());
          setRecommended([...sameCategory, ...recent].slice(0, 6));
        }
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
  const safeSourceUrl = article ? safeHttpUrl(article.source_url, true) : null;
  const articleImage = article ? safeHttpUrl(article.image_url) : null;
  const savedDescription = article?.seo_description?.trim() || '';
  const savedDescriptionComplete = /[.!?…][”’"')\]]?$/.test(savedDescription);
  const seoDescription = article
    ? createSeoDescription(savedDescription.length >= 60 && savedDescriptionComplete ? savedDescription : article.content, article.title)
    : undefined;

  const articleSchema = article
    ? {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: article.title,
        articleBody: article.content.replace(/[#*_>]/g, ' ').replace(/\s+/g, ' ').trim(),
        citation: safeSourceUrl || undefined,
        description: seoDescription,
        image: articleImage ? [{ '@type': 'ImageObject', url: articleImage, caption: article.title, representativeOfPage: true }] : undefined,
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
    image: articleImage,
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

      {seoDescription && (
        <p className="mt-3 text-lg text-gray-600 font-serif italic leading-relaxed">
          {seoDescription}
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

      {articleImage && (
        <figure className="mt-6 -mx-4 sm:mx-0">
          <img
            src={articleImage}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
            alt={`${article.title} — ${article.category} news`}
            title={article.title}
            sizes="(max-width: 768px) 100vw, 768px"
            itemProp="image"
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

      {safeSourceUrl && (
        <div className="mt-10 pt-6 border-t border-gray-200">
          <a
            href={safeSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 hover:underline"
          >
            Read the original source report <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {recommended.length > 0 && (
        <section className="mt-12 border-t-2 border-gray-900 pt-6" aria-labelledby="recommended-stories-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-700">Keep reading</p>
              <h2 id="recommended-stories-heading" className="mt-1 text-2xl font-serif font-bold text-gray-900">
                Recommended Stories
              </h2>
              <p className="mt-1 text-sm text-gray-500">More coverage related to this topic, plus the latest news.</p>
            </div>
            <a href="/" className="shrink-0 text-sm font-semibold text-red-700 hover:text-red-900">All news</a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recommended.map((suggestion) => (
              <ArticleCard key={suggestion.id} article={suggestion} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
