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
    </div>
  );
}

export default App;
