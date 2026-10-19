// Minimal Google Analytics (gtag) helper.
// The gtag script + initial config live in index.html. This module just
// exposes a typed send function and tracks page views on route changes.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export const GA_MEASUREMENT_ID = 'G-66N8NWPZTJ';

/** Send a page_view event for the given path. Safe to call when gtag isn't loaded yet. */
export function trackPageView(path: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    send_to: GA_MEASUREMENT_ID,
  });
}

export {};
