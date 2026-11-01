import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Radio, Clock, Info, AlertCircle, Loader2 } from 'lucide-react';
import {
  fetchMatches, fetchCompetitions, FREE_COMPETITIONS, REFRESH_INTERVAL_MS,
  statusLabel, isLive, type FootballMatch, type Competition,
} from '@/lib/footballService';
import { useSeo } from '@/lib/seo';
import { SITE_CONFIG, ORGANIZATION_SCHEMA, WEBSITE_SCHEMA } from '@/lib/seo-config';

interface FootballPageProps {
  onBack: () => void;
}

function formatKickoff(utc: string): string {
  return new Date(utc).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMatchDate(utc: string): string {
  return new Date(utc).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function MatchRow({ match }: { match: FootballMatch }) {
  const live = isLive(match.status);
  return (
    <li
      className="flex items-center gap-3 py-3 px-4 border-b border-gray-100 last:border-b-0"
      role="group"
      aria-label={`${match.homeTeam} vs ${match.awayTeam}, ${match.status === 'FINISHED' ? 'final score' : 'live'} ${match.homeScore ?? 0} to ${match.awayScore ?? 0}`}
    >
      <span className="text-xs text-gray-400 w-20 shrink-0 truncate hidden sm:block" title={match.competition}>
        {match.competition}
      </span>
      <span className="text-xs text-gray-400 sm:hidden shrink-0" title={match.competition}>
        {match.competitionCode}
      </span>
      <span className="font-semibold text-gray-900 w-16 sm:w-20 text-right truncate" title={match.homeTeam}>
        {match.homeTla}
      </span>
      <span className="font-serif font-bold text-gray-900 tabular-nums px-1.5 shrink-0">
        {match.homeScore ?? '-'} - {match.awayScore ?? '-'}
      </span>
      <span className="font-semibold text-gray-900 w-16 sm:w-20 truncate" title={match.awayTeam}>
        {match.awayTla}
      </span>
      <span
        className={`ml-auto text-xs font-medium tabular-nums shrink-0 ${live ? 'text-red-700' : 'text-gray-400'}`}
      >
        {live && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-700 animate-pulse" aria-hidden="true" />
            {statusLabel(match.status, match.minute)}
          </span>
        )}
        {!live && statusLabel(match.status, match.minute)}
      </span>
    </li>
  );
}

export function FootballPage({ onBack }: FootballPageProps) {
  const [competitions, setCompetitions] = useState<Competition[]>(FREE_COMPETITIONS);
  const [activeComp, setActiveCom] = useState<string>('all');
  const [live, setLive] = useState<FootballMatch[]>([]);
  const [fixtures, setFixtures] = useState<FootballMatch[]>([]);
  const [results, setResults] = useState<FootballMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchAll = useCallback(async (comp: string) => {
    setLoading(true);
    setError(null);
    const compCode = comp === 'all' ? undefined : comp;

    const [liveRes, scheduledRes, finishedRes] = await Promise.all([
      fetchMatches(compCode, 'LIVE'),
      fetchMatches(compCode, 'SCHEDULED'),
      fetchMatches(compCode, 'FINISHED'),
    ]);

    // If all three failed, show error.
    if (liveRes.error && scheduledRes.error && finishedRes.error) {
      setError(liveRes.error);
      setLive([]);
      setFixtures([]);
      setResults([]);
    } else {
      setLive(liveRes.matches ?? []);
      // Sort fixtures by date ascending (nearest first), take first 12.
      const sortedFixtures = (scheduledRes.matches ?? [])
        .filter((m) => m.status === 'SCHEDULED' || m.status === 'TIMED')
        .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
        .slice(0, 12);
      setFixtures(sortedFixtures);
      // Sort results by date descending (most recent first), take first 12.
      const sortedResults = (finishedRes.matches ?? [])
        .filter((m) => m.status === 'FINISHED')
        .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
        .slice(0, 12);
      setResults(sortedResults);
    }
    setLoading(false);
    setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
  }, []);

  useEffect(() => {
    fetchAll(activeComp);
  }, [activeComp, fetchAll]);

  // Auto-refresh live matches every 30 seconds.
  useEffect(() => {
    const interval = setInterval(async () => {
      const compCode = activeComp === 'all' ? undefined : activeComp;
      const liveRes = await fetchMatches(compCode, 'LIVE');
      if (!liveRes.error) {
        setLive(liveRes.matches ?? []);
        setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      }
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeComp]);

  // SEO — stable metadata, does not change per refresh.
  const seoTitle = 'Live Football Scores Today | Fixtures, Results & Match Updates';
  const seoDescription = 'Follow real-time football scores, live match updates, upcoming fixtures and recent results from major football competitions around the world.';
  const canonicalUrl = `${SITE_CONFIG.url}/#/football`;

  const jsonLd = useMemo(() => ([
    ORGANIZATION_SCHEMA,
    WEBSITE_SCHEMA,
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: seoTitle,
      url: canonicalUrl,
      description: seoDescription,
      inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', name: SITE_CONFIG.name, url: SITE_CONFIG.url },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_CONFIG.url },
          { '@type': 'ListItem', position: 2, name: 'Football', item: canonicalUrl },
        ],
      },
    },
  ]), [seoTitle, seoDescription, canonicalUrl]);

  useSeo({
    title: seoTitle,
    description: seoDescription,
    type: 'website',
    url: canonicalUrl,
    jsonLd,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to homepage
      </button>

      <h1 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900 mb-2">
        Live Football Scores & Fixtures
      </h1>
      <p className="text-gray-600 mb-6">
        Real-time scores, upcoming fixtures, and recent results from major football competitions. Live scores update every 30 seconds.
      </p>

      {/* Competition filter */}
      <nav aria-label="Filter by competition" className="mb-8">
        <ul className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <li>
            <button
              onClick={() => setActiveCom('all')}
              className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                activeComp === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              aria-pressed={activeComp === 'all'}
            >
              All Competitions
            </button>
          </li>
          {competitions.map((c) => (
            <li key={c.code}>
              <button
                onClick={() => setActiveCom(c.code)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                  activeComp === c.code
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                aria-pressed={activeComp === c.code}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {loading && (
        <div className="space-y-6 animate-pulse">
          <div className="h-40 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-20" role="alert">
          <AlertCircle className="h-8 w-8 text-amber-600 mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-700 font-medium">Football data is temporarily unavailable.</p>
          <p className="text-sm text-gray-500 mt-2">{error}</p>
          <p className="text-sm text-gray-500 mt-2">This may be a rate limit or a missing API key on the server. Please try again shortly.</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Live matches */}
          <section aria-labelledby="live-heading" className="bg-white rounded-sm border border-gray-200 shadow-sm mb-8">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="relative flex items-center justify-center shrink-0">
                  <span className="absolute inset-0 rounded-full bg-red-600/30 animate-ping" style={{ animationDuration: '2.5s' }} />
                  <Radio className="relative h-4 w-4 text-red-700" aria-hidden="true" />
                </span>
                <h2 id="live-heading" className="text-sm font-bold uppercase tracking-[0.15em] text-gray-700">
                  Live Matches
                </h2>
              </div>
              {lastUpdated && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  Updated {lastUpdated}
                </span>
              )}
            </div>
            {live.length === 0 ? (
              <div className="flex items-center justify-center py-10 px-4 text-center" role="status">
                <p className="text-sm text-gray-500 leading-relaxed">
                  No live matches currently in progress. Check back during game times.
                </p>
              </div>
            ) : (
              <ul aria-label="Live football matches">
                {live.map((m) => <MatchRow key={m.id} match={m} />)}
              </ul>
            )}
          </section>

          {/* Upcoming fixtures */}
          <section aria-labelledby="fixtures-heading" className="bg-white rounded-sm border border-gray-200 shadow-sm mb-8">
            <h2 id="fixtures-heading" className="text-sm font-bold uppercase tracking-[0.15em] text-gray-700 px-4 py-3 border-b border-gray-100">
              Upcoming Fixtures
            </h2>
            {fixtures.length === 0 ? (
              <div className="flex items-center justify-center py-10 px-4 text-center" role="status">
                <p className="text-sm text-gray-500">No upcoming fixtures scheduled.</p>
              </div>
            ) : (
              <ul aria-label="Upcoming football fixtures">
                {fixtures.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 py-3 px-4 border-b border-gray-100 last:border-b-0"
                    role="group"
                    aria-label={`${m.homeTeam} vs ${m.awayTeam}, kickoff ${formatKickoff(m.utcDate)}`}
                  >
                    <span className="text-xs text-gray-400 w-20 shrink-0 truncate hidden sm:block" title={m.competition}>
                      {m.competition}
                    </span>
                    <span className="text-xs text-gray-400 sm:hidden shrink-0" title={m.competition}>
                      {m.competitionCode}
                    </span>
                    <span className="font-semibold text-gray-900 w-16 sm:w-20 text-right truncate" title={m.homeTeam}>
                      {m.homeTla}
                    </span>
                    <span className="text-gray-400 px-1.5 shrink-0 text-sm">vs</span>
                    <span className="font-semibold text-gray-900 w-16 sm:w-20 truncate" title={m.awayTeam}>
                      {m.awayTla}
                    </span>
                    <span className="ml-auto text-xs text-gray-500 tabular-nums shrink-0">
                      {formatKickoff(m.utcDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent results */}
          <section aria-labelledby="results-heading" className="bg-white rounded-sm border border-gray-200 shadow-sm mb-8">
            <h2 id="results-heading" className="text-sm font-bold uppercase tracking-[0.15em] text-gray-700 px-4 py-3 border-b border-gray-100">
              Recent Results
            </h2>
            {results.length === 0 ? (
              <div className="flex items-center justify-center py-10 px-4 text-center" role="status">
                <p className="text-sm text-gray-500">No recent results available.</p>
              </div>
            ) : (
              <ul aria-label="Recent football results">
                {results.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 py-3 px-4 border-b border-gray-100 last:border-b-0"
                    role="group"
                    aria-label={`${m.homeTeam} vs ${m.awayTeam}, final score ${m.homeScore} to ${m.awayScore}`}
                  >
                    <span className="text-xs text-gray-400 w-20 shrink-0 truncate hidden sm:block" title={m.competition}>
                      {m.competition}
                    </span>
                    <span className="text-xs text-gray-400 sm:hidden shrink-0" title={m.competition}>
                      {m.competitionCode}
                    </span>
                    <span className="font-semibold text-gray-900 w-16 sm:w-20 text-right truncate" title={m.homeTeam}>
                      {m.homeTla}
                    </span>
                    <span className="font-serif font-bold text-gray-900 tabular-nums px-1.5 shrink-0">
                      {m.homeScore} - {m.awayScore}
                    </span>
                    <span className="font-semibold text-gray-900 w-16 sm:w-20 truncate" title={m.awayTeam}>
                      {m.awayTla}
                    </span>
                    <span className="ml-auto text-xs text-gray-400 tabular-nums shrink-0">
                      {formatMatchDate(m.utcDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* SEO content block */}
          <section className="mt-8" aria-labelledby="football-info-heading">
            <h2 id="football-info-heading" className="text-xl font-serif font-bold text-gray-900 mb-3">
              Live Football Scores & Match Updates
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Follow live football scores today with real-time match updates from the Premier League, La Liga, Bundesliga, Serie A, Ligue 1, and the UEFA Champions League.
              Check today's football fixtures, live soccer scores, and recent results as they happen. Matches in progress show the current minute, while upcoming fixtures display kickoff times in your local timezone.
            </p>
            <div className="flex items-start gap-1.5 text-xs text-gray-400">
              <Info className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="leading-snug">
                Data sourced from football-data.org. The free tier covers 12 top competitions; live scores update during active matches.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
