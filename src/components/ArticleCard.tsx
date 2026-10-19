import { Link } from 'lucide-react';
import type { ArticleSummary } from '@/types/article';
import { categoryColor } from '@/lib/categories';
import { formatTimeAgo } from '@/lib/date';

interface ArticleCardProps {
  article: ArticleSummary;
  variant?: 'default' | 'feature' | 'compact';
}

export function ArticleCard({ article, variant = 'default' }: ArticleCardProps) {
  const color = categoryColor(article.category);
  const fallback = `https://picsum.photos/seed/${article.id}/1200/700`;

  if (variant === 'feature') {
    return (
      <a
        href={`#/article/${article.id}`}
        className="group block bg-white rounded-sm overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
      >
        <div className="aspect-[16/9] overflow-hidden bg-gray-100">
          <img
            src={article.image_url || fallback}
            alt={article.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        </div>
        <div className="p-5 sm:p-7">
          <span className={`inline-block text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${color.bg} ${color.text}`}>
            {article.category}
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-serif font-bold leading-tight text-gray-900 group-hover:text-gray-700 transition-colors">
            {article.title}
          </h2>
          <p className="mt-3 text-gray-600 font-serif text-base leading-relaxed line-clamp-3">
            {article.seo_description || ''}
          </p>
          <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
            <span>{formatTimeAgo(article.created_at)}</span>
            {article.source_url && (
              <span className="inline-flex items-center gap-1">
                <Link className="h-3 w-3" /> Source
              </span>
            )}
          </div>
        </div>
      </a>
    );
  }

  if (variant === 'compact') {
    return (
      <a
        href={`#/article/${article.id}`}
        className="group flex gap-3 py-3 border-b border-gray-200"
      >
        <div className="w-20 h-20 shrink-0 overflow-hidden bg-gray-100 rounded-sm">
          <img
            src={article.image_url || `https://picsum.photos/seed/${article.id}/200/200`}
            alt={article.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        </div>
        <div className="min-w-0 flex-1">
          <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>
            {article.category}
          </span>
          <h3 className="mt-1 text-sm font-serif font-bold leading-snug text-gray-900 group-hover:text-gray-600 transition-colors line-clamp-3">
            {article.title}
          </h3>
          <span className="text-[11px] text-gray-400">{formatTimeAgo(article.created_at)}</span>
        </div>
      </a>
    );
  }

  return (
    <a
      href={`#/article/${article.id}`}
      className="group flex flex-col bg-white rounded-sm overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
    >
      <div className="aspect-[16/10] overflow-hidden bg-gray-100">
        <img
          src={article.image_url || fallback}
          alt={article.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
        />
      </div>
      <div className="p-4 flex flex-col flex-1">
        <span className={`inline-block self-start text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${color.bg} ${color.text}`}>
          {article.category}
        </span>
        <h3 className="mt-2 text-lg font-serif font-bold leading-snug text-gray-900 group-hover:text-gray-700 transition-colors line-clamp-3">
          {article.title}
        </h3>
        <p className="mt-2 text-sm text-gray-600 font-serif leading-relaxed line-clamp-2">
          {article.seo_description || ''}
        </p>
        <div className="mt-auto pt-3 text-xs text-gray-400">
          {formatTimeAgo(article.created_at)}
        </div>
      </div>
    </a>
  );
}
