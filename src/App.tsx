import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PodcastPlayer } from '@/components/PodcastPlayer';
import { HomePage } from '@/pages/HomePage';
import { ArticlePage } from '@/pages/ArticlePage';
import { WeatherPage } from '@/pages/WeatherPage';
import { FootballPage } from '@/pages/FootballPage';
import { trackPageView } from '@/lib/analytics';

type Route =
  | { name: 'home' }
  | { name: 'article'; id: number }
  | { name: 'weather' }
  | { name: 'football' };

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  const m = /^article\/(\d+)$/.exec(h);
  if (m) return { name: 'article', id: Number(m[1]) };
  if (h === 'weather') return { name: 'weather' };
  if (h === 'football') return { name: 'football' };
  return { name: 'home' };
}

function routeToPath(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : h ? `/${h}` : '/';
}

function App() {
  const [route, setRoute] = useState<Route>(() => parseHash());

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    trackPageView(routeToPath());
  }, [route]);

  const goHome = () => {
    window.location.hash = '';
  };

  const openArticle = (id: number) => {
    window.location.hash = `/article/${id}`;
  };

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <Header onHome={goHome} />
      <main className="flex-1">
        {route.name === 'home' && <HomePage onOpenArticle={openArticle} onNavigate={navigate} />}
        {route.name === 'article' && <ArticlePage id={route.id} onBack={goHome} />}
        {route.name === 'weather' && <WeatherPage onBack={goHome} />}
        {route.name === 'football' && <FootballPage onBack={goHome} />}
      </main>
      <Footer onHome={goHome} />
      <PodcastPlayer variant="overlay" />
    </div>
  );
}

export default App;
