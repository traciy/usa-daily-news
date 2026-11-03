import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PodcastPlayer } from '@/components/PodcastPlayer';
import { HomePage } from '@/pages/HomePage';
import { ArticlePage } from '@/pages/ArticlePage';
import { WeatherPage } from '@/pages/WeatherPage';
import { FootballPage } from '@/pages/FootballPage';
import { ContactPage } from '@/pages/ContactPage';
import { AboutPage, EditorialPolicyPage, CorrectionsPolicyPage, PrivacyPolicyPage } from '@/pages/TrustPages';
import { trackPageView } from '@/lib/analytics';
import type { Category } from '@/lib/categories';

type Route =
  | { name: 'home'; category?: Category }
  | { name: 'article'; id: number }
  | { name: 'weather' }
  | { name: 'football' }
  | { name: 'contact' }
  | { name: 'about' }
  | { name: 'editorial' }
  | { name: 'corrections' }
  | { name: 'privacy' };

function parsePath(): Route {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const article = /^\/article\/(\d+)$/.exec(path);
  if (article) return { name: 'article', id: Number(article[1]) };
  if (path === '/politics') return { name: 'home', category: 'Politics' };
  if (path === '/tech') return { name: 'home', category: 'Tech' };
  if (path === '/economy') return { name: 'home', category: 'Economy' };
  if (path === '/culture') return { name: 'home', category: 'Culture' };
  if (path === '/weather') return { name: 'weather' };
  if (path === '/contact') return { name: 'contact' };
  if (path === '/about') return { name: 'about' };
  if (path === '/editorial-policy') return { name: 'editorial' };
  if (path === '/corrections') return { name: 'corrections' };
  if (path === '/privacy-policy') return { name: 'privacy' };
  if (path === '/football' || path === '/sports') return { name: 'football' };

  const legacy = window.location.hash.replace(/^#\/?/, '');
  const legacyArticle = /^article\/(\d+)$/.exec(legacy);
  if (legacyArticle) {
    const next = '/article/' + legacyArticle[1];
    window.history.replaceState({}, '', next);
    return { name: 'article', id: Number(legacyArticle[1]) };
  }
  if (legacy === 'weather' || legacy === 'football') {
    window.history.replaceState({}, '', '/' + legacy);
    return legacy === 'weather' ? { name: 'weather' } : { name: 'football' };
  }
  return { name: 'home' };
}

function App() {
  const [route, setRoute] = useState<Route>(() => parsePath());
  const [showAdBlockNotice, setShowAdBlockNotice] = useState(false);

  useEffect(() => {
    let active = true;
    let bait: HTMLDivElement | null = null;
    let timer: number | undefined;

    try {
      if (sessionStorage.getItem('usa-daily-news-ad-notice-dismissed') === '1') return;
    } catch {
      // Continue with detection when browser storage is unavailable.
    }

    timer = window.setTimeout(() => {
      bait = document.createElement('div');
      bait.className = 'adsbox ad-placement ad-unit';
      bait.setAttribute('aria-hidden', 'true');
      bait.style.cssText = 'position:absolute;left:-10000px;top:-10000px;width:10px;height:10px;pointer-events:none;';
      document.body.appendChild(bait);

      window.setTimeout(() => {
        if (!active || !bait) return;
        const styles = window.getComputedStyle(bait);
        const blocked = bait.offsetHeight === 0 || bait.offsetWidth === 0 ||
          styles.display === 'none' || styles.visibility === 'hidden';
        bait.remove();
        bait = null;
        if (blocked) setShowAdBlockNotice(true);
      }, 350);
    }, 1200);

    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      bait?.remove();
    };
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(parsePath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    trackPageView(window.location.pathname);
  }, [route]);

  const navigate = (path: string) => {
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    window.history.pushState({}, '', cleanPath);
    setRoute(parsePath());
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const goHome = () => navigate('/');
  const openArticle = (id: number) => navigate('/article/' + id);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <Header onHome={goHome} />
      <main className="flex-1">
        {route.name === 'home' && <HomePage key={route.category ?? 'all'} initialCategory={route.category} onOpenArticle={openArticle} onNavigate={navigate} />}
        {route.name === 'article' && <ArticlePage id={route.id} onBack={goHome} />}
        {route.name === 'weather' && <WeatherPage onBack={goHome} />}
        {route.name === 'football' && <FootballPage onBack={goHome} />}
        {route.name === 'contact' && <ContactPage />}
        {route.name === 'about' && <AboutPage />}
        {route.name === 'editorial' && <EditorialPolicyPage />}
        {route.name === 'corrections' && <CorrectionsPolicyPage />}
        {route.name === 'privacy' && <PrivacyPolicyPage />}
      </main>
      <Footer onHome={goHome} />
      <PodcastPlayer variant="overlay" />
      {showAdBlockNotice && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:bottom-5"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-lg" aria-hidden="true">♥</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900">Help keep USA Daily News free</p>
              <p className="mt-1 text-sm leading-5 text-gray-600">
                It looks like an ad blocker may be preventing our ads from loading. Advertising helps us provide free news. If you would like to support us, please allow ads on this site and reload the page.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-lg bg-red-800 px-3 py-2 text-sm font-semibold text-white hover:bg-red-900"
                >
                  I've allowed ads — reload
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      sessionStorage.setItem('usa-daily-news-ad-notice-dismissed', '1');
                    } catch {
                      // Dismiss for this page view if storage is unavailable.
                    }
                    setShowAdBlockNotice(false);
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Continue reading
                </button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setShowAdBlockNotice(false)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

export default App;
