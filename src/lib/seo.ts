import { useEffect } from 'react';
import { SITE_CONFIG } from '@/lib/seo-config';

export interface SeoOptions {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  /** When provided, injects this object as a JSON-LD structured data block. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Published date (ISO) for article schema. */
  publishedTime?: string;
  /** Section / category for article schema. */
  section?: string;
}

/** Hard limit on meta description length for snippet display. */
const MAX_DESC = 155;
const MAX_TITLE = 60;

export function createSeoDescription(content?: string | null, fallbackTitle?: string): string {
  const clean = (content || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#*_>\`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = clean.match(/^.{35,}?([.!?](?=\s|$)|$)/)?.[0]?.trim() || clean;
  const source = sentence.length >= 45 ? sentence : clean;
  if (source.length <= MAX_DESC) return source || fallbackTitle || SITE_CONFIG.description;
  const shortened = source.slice(0, MAX_DESC - 3).replace(/\s+\S*$/, "").trim();
  return shortened ? shortened + "…" : source.slice(0, MAX_DESC - 3).trimEnd() + "…";
}
export function createSeoTitle(headline: string): string {
  const suffix = " | USA Daily News";
  const maxHeadline = MAX_TITLE - suffix.length;
  const cleanHeadline = headline.length > maxHeadline
    ? headline.slice(0, maxHeadline - 1).trimEnd() + "…"
    : headline;
  return cleanHeadline + suffix;
}

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMeta(attr: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function removeStaleJsonLd() {
  document.head
    .querySelectorAll('script[data-dynamic-jsonld], script[data-server-article-jsonld]')
    .forEach((el) => el.remove());
}

function injectJsonLd(data: Record<string, unknown> | Record<string, unknown>[]) {
  removeStaleJsonLd();
  const blocks = Array.isArray(data) ? data : [data];
  for (const block of blocks) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-dynamic-jsonld', 'true');
    script.textContent = JSON.stringify(block);
    document.head.appendChild(script);
  }
}

/**
 * Updates document title, canonical link, Open Graph / Twitter meta tags, and
 * JSON-LD structured data on mount and whenever the options change.
 * Used on every page for per-route SEO.
 */
export function useSeo(opts: SeoOptions) {
  const title = clamp(opts.title, MAX_TITLE);
  const description = opts.description ? clamp(opts.description, MAX_DESC) : SITE_CONFIG.description;
  const url = opts.url || window.location.href.split('#')[0];
  const image = opts.image || SITE_CONFIG.ogImage;
  const type = opts.type || 'website';

  useEffect(() => {
    document.title = title;

    setMeta('name', 'description', description);

    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:alt', opts.title);
    setMeta('property', 'og:site_name', SITE_CONFIG.name);
    setMeta('property', 'og:locale', 'en_US');

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setMeta('name', 'twitter:image:alt', opts.title);

    if (opts.publishedTime) {
      setMeta('property', 'article:published_time', opts.publishedTime);
    } else {
      removeMeta('property', 'article:published_time');
    }
    if (opts.section) {
      setMeta('property', 'article:section', opts.section);
    } else {
      removeMeta('property', 'article:section');
    }

    setLink('canonical', url);

    if (opts.jsonLd) {
      injectJsonLd(opts.jsonLd);
    } else {
      removeStaleJsonLd();
    }
  }, [title, description, url, image, type, opts.publishedTime, opts.section, opts.jsonLd]);
}
