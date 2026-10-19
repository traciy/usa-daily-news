import { useEffect } from 'react';

interface SeoOptions {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
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

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Updates document title and social/SEO meta tags on mount and whenever the
 * options change. Used on the article page for per-article SEO.
 */
export function useSeo(opts: SeoOptions) {
  useEffect(() => {
    document.title = opts.title;
    if (opts.description) {
      setMeta('name', 'description', opts.description);
      setMeta('property', 'og:description', opts.description);
      setMeta('name', 'twitter:description', opts.description);
    }
    setMeta('property', 'og:title', opts.title);
    setMeta('name', 'twitter:title', opts.title);
    if (opts.type) setMeta('property', 'og:type', opts.type);
    if (opts.image) {
      setMeta('property', 'og:image', opts.image);
      setMeta('name', 'twitter:image', opts.image);
      setLink('image_src', opts.image);
    }
    if (opts.url) {
      setLink('canonical', opts.url);
      setMeta('property', 'og:url', opts.url);
    }
  }, [opts.title, opts.description, opts.image, opts.url, opts.type]);
}
