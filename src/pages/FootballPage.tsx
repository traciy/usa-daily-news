import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Radio, Clock, Info, AlertCircle, ChevronDown, MapPin, Newspaper, Users } from 'lucide-react';
import {
  fetchMatches, fetchCompetitions, FREE_COMPETITIONS, REFRESH_INTERVAL_MS,
  statusLabel, isLive, fetchMatchDetails, fetchSportsNews,
  type FootballMatch, type Competition, type SoccerMatchDetails, type SportsNewsArticle,
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

function MatchDetailsPanel({ match, open }: { match: FootballMatch; open: boolean }) {
  const [details, setDetails] = useState<SoccerMatchDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open || details || loading) return;
    let active = true;
    setLoading(true);
    fetchMatchDetails(match.competitionCode, match.id).then((result) => {
      if (!active) return;
      if (result.error) setError(result.error);
      else setDetails(result.details ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [open, details, loading, match.competitionCode, match.id]);
  if (!open) return null;
  if (loading) return <div className="border-t border-gray-100 bg-gray-50 px-4 py-6 text-sm text-gray-500" role="status">Loading match report and available statistics…</div>;
  if (error || !details) return <div className="border-t border-gray-100 bg-gray-50 px-4 py-5 text-sm text-gray-500">{error || 'Match details are not available yet. Please try again shortly.'}</div>;
  const teams = details.boxscore?.teams ?? [];
  const homeStats = teams.find((team) => team.team?.displayName === match.homeTeam);
  const awayStats = teams.find((team) => team.team?.displayName === match.awayTeam);
  const homeValues = homeStats?.statistics ?? [];
  const awayValues = awayStats?.statistics ?? [];
  const statRows = homeValues.map((stat) => ({
    name: stat.displayName || stat.name || 'Match statistic',
    home: stat.displayValue || '—',
    away: awayValues.find((other) => (other.name || other.displayName) === (stat.name || stat.displayName))?.displayValue || '—',
  }));
  const events = details.keyEvents ?? [];
  const rosters = details.rosters ?? [];
  const venue = details.gameInfo?.venue;
  const h2h = details.seasonseries ?? [];
  const hasDetails = events.length > 0 || statRows.length > 0 || rosters.length > 0 || Boolean(venue) || h2h.length > 0;
  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-5 sm:px-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Match timeline</h3>
          {events.length ? <ol className="space-y-3 border-l-2 border-gray-200 ml-2 pl-4">
            {events.slice(0, 16).map((event, index) => <li key={event.id || index} className="relative text-sm">
              <span className="absolute -left-[1.38rem] top-1.5 h-2 w-2 rounded-full bg-gray-500" />
              <span className="font-semibold text-gray-800">{event.clock?.displayValue || 'Event'}</span>
              <span className="text-gray-600"> · {event.text || event.type?.text || event.type?.abbreviation || 'Match event'}</span>
              {event.team?.displayName && <span className="block text-xs text-gray-400">{event.team.displayName}</span>}
            </li>)}
          </ol> : <p className="text-sm text-gray-500">No event timeline has been published for this match yet.</p>}
        </section>
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Match statistics</h3>
          {statRows.length ? <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-xs font-semibold text-gray-600"><span>{match.homeTeam}</span><span className="text-center">Stat</span><span className="text-right">{match.awayTeam}</span></div>
            {statRows.slice(0, 12).map((stat) => <div key={stat.name} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
              <span className="font-semibold text-gray-800">{stat.home}</span><span className="text-gray-500 text-center">{stat.name}</span><span className="font-semibold text-gray-800 text-right">{stat.away}</span>
            </div>)}
          </div> : <p className="text-sm text-gray-500">Detailed possession and shot statistics are not supplied for this match. No figures have been estimated.</p>}
        </section>
      </div>
      {rosters.length > 0 && <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Team line-ups</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rosters.map((team, index) => <div key={team.team?.displayName || index} className="rounded border border-gray-200 bg-white p-3">
            <h4 className="font-semibold text-sm mb-2">{team.team?.displayName || 'Team'}</h4>
            <ul className="space-y-1 text-xs text-gray-600">{(team.roster || []).slice(0, 18).map((player, playerIndex) => <li key={player.athlete?.displayName || playerIndex} className="flex justify-between gap-2"><span>{player.athlete?.displayName || 'Player'}</span><span className="text-gray-400">{player.position?.abbreviation || (player.starter ? 'Starter' : '')}</span></li>)}</ul>
          </div>)}
        </div>
      </section>}
      {h2h.length > 0 && <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Season head-to-head</h3>
        {h2h.map((series, index) => <div key={index} className="text-sm text-gray-600">{series.summary || 'Previous meetings'}{series.events?.slice(0, 3).map((event) => <p key={event.id || event.date}>{event.name || event.date}</p>)}</div>)}
      </section>}
      {venue && <p className="text-xs text-gray-500 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {venue.fullName}{venue.address?.city ? `, ${venue.address.city}` : ''}{venue.address?.country ? `, ${venue.address.country}` : ''}{details.gameInfo?.attendance ? ` · Attendance: ${details.gameInfo.attendance.toLocaleString()}` : ''}</p>}
      {!hasDetails && <p className="text-sm text-gray-500">The data provider has not released a detailed report for this fixture yet. Match information will appear here when available.</p>}
      <p className="text-[11px] text-gray-400">Match data supplied by ESPN. Statistics and line-ups appear only when the provider publishes them.</p>
    </div>
  );
}

function ExpandableMatch({ match }: { match: FootballMatch }) {
  const [open, setOpen] = useState(false);
  const live = isLive(match.status);
  return <li id={`match-${match.id}`} className="border-b border-gray-100 last:border-b-0">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={`match-details-${match.id}`}
      className="w-full flex items-center gap-2 sm:gap-3 py-3 px-4 text-left hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
      aria-label={`${match.homeTeam} vs ${match.awayTeam}. ${open ? 'Hide' : 'Show'} match details.`}>
      <span className="text-xs text-gray-400 w-20 shrink-0 truncate hidden sm:block" title={match.competition}>{match.competition}</span>
      <span className="text-xs text-gray-400 sm:hidden shrink-0">{match.competitionCode}</span>
      <span className="font-semibold text-gray-900 flex-1 min-w-0 text-xs sm:text-sm text-right" title={match.homeTeam}>{match.homeTeam}</span>
      <span className="font-serif font-bold text-gray-900 tabular-nums px-1.5 shrink-0">{match.homeScore ?? (match.status === 'SCHEDULED' || match.status === 'TIMED' ? 'vs' : '—')}{match.homeScore !== null && match.awayScore !== null ? ' – ' : ''}{match.awayScore ?? ''}</span>
      <span className="font-semibold text-gray-900 flex-1 min-w-0 text-xs sm:text-sm" title={match.awayTeam}>{match.awayTeam}</span>
      <span className={`ml-auto text-xs font-medium tabular-nums shrink-0 ${live ? 'text-red-700' : 'text-gray-500'}`}>{live && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-700 mr-1 animate-pulse" aria-hidden="true" />}{live ? statusLabel(match.status, match.minute) : match.status === 'FINISHED' ? 'FT' : formatKickoff(match.utcDate)}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
    <div id={`match-details-${match.id}`} hidden={!open}><MatchDetailsPanel match={match} open={open} /></div>
  </li>;
}

function RecentSportsNews() {
  const [articles, setArticles] = useState<SportsNewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetchSportsNews().then((result) => {
      if (!active) return;
      setArticles(result.articles ?? []);
      setError(Boolean(result.error));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);
  return <section aria-labelledby="recent-sports-news" className="mb-8">
    <div className="flex items-center gap-2 mb-4"><Newspaper className="h-5 w-5 text-gray-500" aria-hidden="true" /><h2 id="recent-sports-news" className="text-xl font-serif font-bold text-gray-900">Latest Sports News</h2></div>
    {loading && <p className="text-sm text-gray-500 py-4" role="status">Loading recent sports headlines…</p>}
    {!loading && error && <p className="text-sm text-gray-500 py-4">Recent sports news is temporarily unavailable.</p>}
    {!loading && !error && articles.length === 0 && <p className="text-sm text-gray-500 py-4">New sports coverage will appear here as it is published.</p>}
    {!loading && !error && articles.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {articles.map((article) => <article key={article.id} className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        <a href={`/article/${article.id}`} className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          <img src={article.image_url || '/og-default.svg'} alt={article.image_url ? article.title : 'USA Daily News sports coverage'} title={article.title} width={640} height={360} sizes="(max-width: 640px) 100vw, 50vw" loading="lazy" decoding="async" onError={(event) => { if (event.currentTarget.dataset.fallbackApplied !== 'true') { event.currentTarget.dataset.fallbackApplied = 'true'; event.currentTarget.src = '/og-default.svg'; } }} className="w-full aspect-video object-cover bg-gray-100" />
          <div className="p-4"><p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Sports · {new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p><h3 className="font-serif font-bold text-gray-900 leading-snug group-hover:text-blue-800">{article.title}</h3>{article.seo_description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{article.seo_description}</p>}<span className="inline-block mt-3 text-xs font-semibold text-blue-700">Read sports story</span></div>
        </a>
      </article>)}
    </div>}
  </section>;
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
  const canonicalUrl = `${SITE_CONFIG.url}/football`;

  const jsonLd = useMemo(() => ([
    ORGANIZATION_SCHEMA,
    WEBSITE_SCHEMA,
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: seoTitle,
      url: canonicalUrl,
      description: seoDescription,
      inLanguage: 'en-US',
      keywords: ['live football scores', 'football fixtures today', 'soccer results', 'match analysis', 'Premier League scores', 'La Liga scores', 'Bundesliga scores', 'Serie A scores', 'Ligue 1 scores', 'Champions League scores', 'sports news'],
      isPartOf: { '@type': 'WebSite', name: SITE_CONFIG.name, url: SITE_CONFIG.url },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_CONFIG.url },
          { '@type': 'ListItem', position: 2, name: 'Football Scores & Sports News', item: canonicalUrl },
        ],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Live football scores, upcoming fixtures and recent results',
      itemListElement: [...live, ...fixtures, ...results].slice(0, 30).map((match, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${canonicalUrl}#match-${match.id}`,
        item: {
          '@type': 'SportsEvent',
          name: `${match.homeTeam} vs ${match.awayTeam}`,
          sport: 'Soccer',
          startDate: match.utcDate,
          homeTeam: { '@type': 'SportsTeam', name: match.homeTeam },
          awayTeam: { '@type': 'SportsTeam', name: match.awayTeam },
          eventStatus: match.status === 'FINISHED' ? 'https://schema.org/EventCompleted' : isLive(match.status) ? 'https://schema.org/EventInProgress' : 'https://schema.org/EventScheduled',
          description: `${match.competition}: ${match.homeTeam} vs ${match.awayTeam}${match.homeScore !== null && match.awayScore !== null ? `, score ${match.homeScore}-${match.awayScore}` : ''}`,
        },
      })),
    },
  ]), [seoTitle, seoDescription, canonicalUrl, live, fixtures, results]);

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
                {live.map((m) => <ExpandableMatch key={m.id} match={m} />)}
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
                  <ExpandableMatch key={m.id} match={m} />
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
                  <ExpandableMatch key={m.id} match={m} />
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
      <RecentSportsNews />
    </div>
  );
}
