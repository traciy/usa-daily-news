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
    if (!open) return;
    let active = true;
    setError(null);
    setLoading(true);
    const loadDetails = async () => {
      const result = await fetchMatchDetails(match.competitionCode, match.id);
      if (!active) return;
      if (result.error) setError(result.error);
      else {
        setDetails(result.details ?? null);
        setError(null);
      }
      setLoading(false);
    };
    loadDetails();
    const interval = setInterval(loadDetails, REFRESH_INTERVAL_MS);
    return () => { active = false; clearInterval(interval); };
  }, [open, match.competitionCode, match.id]);
  if (!open) return null;
  if (loading) return <div className="border-t border-gray-100 bg-gray-50 px-4 py-6 text-sm text-gray-500" role="status">Loading match report and available statistics…</div>;
  if (error || !details) return <div className="border-t border-gray-100 bg-gray-50 px-4 py-5 text-sm text-gray-500">{error || 'Match details are not available yet. Please try again shortly.'}</div>;
  const teams = details.boxscore?.teams ?? details.header?.competitions?.[0]?.competitors ?? [];
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
  const commentary = details.commentary ?? [];
  const rosters = details.rosters ?? [];
  const venue = details.gameInfo?.venue;
  const officials = details.gameInfo?.officials ?? [];
  const h2h = details.seasonseries ?? [];
  const matchState = details.header?.competitions?.[0]?.status?.type?.detail;
  const hasDetails = events.length > 0 || commentary.length > 0 || statRows.length > 0 || rosters.length > 0 || Boolean(venue) || officials.length > 0 || h2h.length > 0;
  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-5 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex min-w-0 items-center gap-2">
          <TeamMark name={match.homeTeam} logo={match.homeLogo} />
          <span className="text-sm font-semibold text-gray-900">{match.homeTeam}</span>
          <strong className="font-serif text-lg tabular-nums text-gray-900">{match.homeScore ?? '—'} - {match.awayScore ?? '—'}</strong>
          <span className="text-sm font-semibold text-gray-900">{match.awayTeam}</span>
          <TeamMark name={match.awayTeam} logo={match.awayLogo} />
        </div>
        <span className="text-xs font-medium text-gray-500">{matchState || statusLabel(match.status, match.minute) || formatKickoff(match.utcDate)}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Match timeline</h3>
          {events.length ? <ol className="space-y-3 border-l-2 border-gray-200 ml-2 pl-4">
            {events.slice(0, 16).map((event, index) => <li key={event.id || index} className="relative text-sm">
              <span className="absolute -left-[1.38rem] top-1.5 h-2 w-2 rounded-full bg-gray-500" />
              <span className="font-semibold text-gray-800">{event.clock?.displayValue || 'Event'}</span>
              <span className="text-gray-600"> · {event.text || event.type?.text || event.type?.abbreviation || 'Match event'}</span>
              {event.team?.displayName && <span className="block text-xs text-gray-400">{event.team.displayName}</span>}
              {event.participants?.length ? <span className="block text-xs text-gray-500">{event.participants.map((participant) => participant.athlete?.displayName).filter(Boolean).join(', ')}</span> : null}
            </li>)}
          </ol> : <p className="text-sm text-gray-500">No event timeline has been published for this match yet.</p>}
        </section>
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Match analytics & team statistics</h3>
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
      {commentary.length > 0 && <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Match commentary</h3>
        <ol className="space-y-2">
          {commentary.slice(-8).reverse().map((entry, index) => <li key={index} className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            {entry.time?.displayValue && <span className="mr-2 font-semibold text-gray-500">{entry.time.displayValue}</span>}
            {entry.text || 'Match update'}
          </li>)}
        </ol>
      </section>}
      {h2h.length > 0 && <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Previous head-to-head meetings</h3>
        {h2h.map((series, index) => <div key={index} className="text-sm text-gray-600">{series.summary || 'Previous meetings'}{series.events?.slice(0, 5).map((event) => <p key={event.id || event.date}>{event.name || event.date}</p>)}</div>)}
      </section>}
      {(venue || officials.length > 0 || details.gameInfo?.attendance) && <section className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">
        {venue && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {venue.fullName}{venue.address?.city ? `, ${venue.address.city}` : ''}{venue.address?.country ? `, ${venue.address.country}` : ''}</p>}
        {details.gameInfo?.attendance ? <p>Attendance: {details.gameInfo.attendance.toLocaleString()}</p> : null}
        {officials.map((official, index) => <p key={official.fullName || index}>Match official: {official.fullName || 'Official'}</p>)}
      </section>}
      {!hasDetails && <p className="text-sm text-gray-500">The data provider has not released a detailed report for this fixture yet. Match information will appear here when available.</p>}
      <p className="text-[11px] text-gray-400">Match data supplied by ESPN. Statistics and line-ups appear only when the provider publishes them.</p>
    </div>
  );
}

function TeamMark({ name, logo }: { name: string; logo?: string | null }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return (
    <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white text-[9px] font-bold text-gray-500" aria-hidden="true">
      <span>{initials || 'FC'}</span>
      {logo && <img src={logo} alt="" width="28" height="28" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full bg-white object-contain" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
    </span>
  );
}

function ExpandableMatch({ match }: { match: FootballMatch }) {
  const [open, setOpen] = useState(false);
  const live = isLive(match.status);
  const scheduled = match.status === 'SCHEDULED' || match.status === 'TIMED';
  const score = match.homeScore !== null && match.awayScore !== null
    ? `${match.homeScore} - ${match.awayScore}`
    : scheduled ? 'vs' : '—';

  return <li id={`match-${match.id}`} className="border-b border-gray-100 last:border-b-0">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={`match-details-${match.id}`}
      className="w-full flex items-center gap-2 sm:gap-3 py-3 px-3 sm:px-4 text-left hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
      <span className="hidden sm:block w-28 shrink-0 truncate text-xs text-gray-500" title={match.competition}>{match.competition}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <span className="min-w-0 truncate text-right text-xs font-semibold text-gray-900 sm:text-sm" title={match.homeTeam}>{match.homeTeam}</span>
        <TeamMark name={match.homeTeam} logo={match.homeLogo} />
      </span>
      <span className={`shrink-0 rounded-md px-2 py-1 font-serif text-sm font-bold tabular-nums sm:text-base ${live ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-900'}`}>{score}</span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        <TeamMark name={match.awayTeam} logo={match.awayLogo} />
        <span className="min-w-0 truncate text-xs font-semibold text-gray-900 sm:text-sm" title={match.awayTeam}>{match.awayTeam}</span>
      </span>
      <span className={`w-[4.5rem] shrink-0 text-right text-[11px] font-medium tabular-nums sm:w-24 sm:text-xs ${live ? 'text-red-700' : 'text-gray-500'}`}>
        {live && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-700" aria-hidden="true" />}
        {live ? statusLabel(match.status, match.minute) : match.status === 'FINISHED' ? 'Full time' : formatKickoff(match.utcDate)}
      </span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
    <div className="px-3 pb-2 text-[10px] text-gray-400 sm:hidden">{match.competition}</div>
    <div id={`match-details-${match.id}`} hidden={!open}><MatchDetailsPanel match={match} open={open} /></div>
  </li>;
}

function MatchList({ matches, label }: { matches: FootballMatch[]; label: string }) {
  const grouped = new Map<string, { competition: string; date: string; matches: FootballMatch[] }>();
  for (const match of matches) {
    const date = new Date(match.utcDate).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const key = `${date}|${match.competition}`;
    const group = grouped.get(key) ?? { competition: match.competition, date, matches: [] };
    group.matches.push(match);
    grouped.set(key, group);
  }

  return <div aria-label={label} className="divide-y divide-gray-100">
    {Array.from(grouped.values()).map((group) => (
      <section key={group.date + group.competition}>
        <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-4 py-2">
          <h3 className="text-xs font-bold text-gray-800">{group.competition}</h3>
          <span className="text-[11px] text-gray-500">{group.date}</span>
        </div>
        <ul>{group.matches.map((match) => <ExpandableMatch key={match.id} match={match} />)}</ul>
      </section>
    ))}
  </div>;
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

const FOOTBALL_FAQS = [
  {
    question: 'How often are live football scores updated?',
    answer: 'The live football score centre checks for updates every 30 seconds. The data provider may delay or revise individual match updates.',
  },
  {
    question: 'Which football competitions are covered?',
    answer: 'The score centre currently covers the Premier League, La Liga, Bundesliga, Serie A, Ligue 1 and the UEFA Champions League.',
  },
  {
    question: 'What can I see in the expanded match centre?',
    answer: 'When available, match reports include key events, player names, line-ups, team statistics, commentary, venue details, attendance, officials and previous meetings.',
  },
  {
    question: 'Are match statistics available for every fixture?',
    answer: 'No. Match statistics and other details are displayed only when the provider makes them available. Missing figures are not estimated.',
  },
];

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

    const allRes = await fetchMatches(compCode);

    if (allRes.error) {
      setError(allRes.error);
      setLive([]);
      setFixtures([]);
      setResults([]);
    } else {
      const matches = allRes.matches ?? [];
      setLive(matches
        .filter((match) => isLive(match.status))
        .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()));
      setFixtures(matches
        .filter((match) => match.status === 'SCHEDULED' || match.status === 'TIMED')
        .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
        .slice(0, 24));
      setResults(matches
        .filter((match) => match.status === 'FINISHED')
        .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
        .slice(0, 24));
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
  const seoTitle = 'Live Football Scores & Fixtures | USA Daily News';
  const seoDescription = 'Follow live football scores, today’s fixtures and results. Explore match timelines, team line-ups, statistics, head-to-head records and sports news.';
  const canonicalUrl = `${SITE_CONFIG.url}/football`;

  const jsonLd = useMemo(() => ([
    ORGANIZATION_SCHEMA,
    WEBSITE_SCHEMA,
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: seoTitle,
      url: canonicalUrl,
      description: seoDescription,
      inLanguage: 'en-US',
      keywords: [
        'live football scores', 'football fixtures today', 'soccer results',
        'football match centre', 'football match analysis', 'team line-ups',
        'football statistics', 'Premier League scores', 'La Liga scores',
        'Bundesliga scores', 'Serie A scores', 'Ligue 1 scores',
        'Champions League scores', 'latest sports news',
      ],
      isPartOf: { '@type': 'WebSite', name: SITE_CONFIG.name, url: SITE_CONFIG.url },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_CONFIG.url },
          { '@type': 'ListItem', position: 2, name: 'Live Football Scores & Fixtures', item: canonicalUrl },
        ],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Live football scores, fixtures and results',
      itemListElement: [...live, ...fixtures, ...results].slice(0, 60).map((match, index) => ({
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
          eventStatus: match.status === 'FINISHED'
            ? 'https://schema.org/EventCompleted'
            : isLive(match.status)
              ? 'https://schema.org/EventInProgress'
              : ['CANCELLED', 'POSTPONED'].includes(match.status)
                ? 'https://schema.org/EventCancelled'
                : 'https://schema.org/EventScheduled',
          description: `${match.competition}: ${match.homeTeam} vs ${match.awayTeam}${match.homeScore !== null && match.awayScore !== null ? `, score ${match.homeScore}-${match.awayScore}` : ''}`,
        },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FOOTBALL_FAQS.map((entry) => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
      })),
    },
  ]), [seoTitle, seoDescription, canonicalUrl, live, fixtures, results]);

  useSeo({
    title: seoTitle,
    description: seoDescription,
    type: 'website',
    url: canonicalUrl,
    image: SITE_CONFIG.ogImage,
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
        Live Football Scores, Fixtures & Match Centre
      </h1>
      <p className="max-w-3xl text-gray-600 leading-relaxed mb-5">
        Follow live soccer scores, today's football fixtures and recent results from the Premier League, La Liga, Bundesliga, Serie A, Ligue 1 and UEFA Champions League. Open a match for available events, line-ups, team statistics, commentary and head-to-head information.
      </p>
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3" aria-label="Football match overview">
        <a href="#live-heading" className="rounded-lg border border-red-100 bg-red-50 p-3 transition hover:border-red-300">
          <span className="block text-2xl font-bold tabular-nums text-red-700">{live.length}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-red-800">Live now</span>
        </a>
        <a href="#fixtures-heading" className="rounded-lg border border-gray-200 bg-white p-3 transition hover:border-gray-400">
          <span className="block text-2xl font-bold tabular-nums text-gray-900">{fixtures.length}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Upcoming</span>
        </a>
        <a href="#results-heading" className="rounded-lg border border-gray-200 bg-white p-3 transition hover:border-gray-400">
          <span className="block text-2xl font-bold tabular-nums text-gray-900">{results.length}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Results</span>
        </a>
      </div>
      <nav aria-label="Football score centre sections" className="mb-5 flex flex-wrap gap-2 text-xs font-semibold">
        <a href="#live-heading" className="rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:border-red-300 hover:text-red-700">Live matches</a>
        <a href="#fixtures-heading" className="rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:border-red-300 hover:text-red-700">Upcoming fixtures</a>
        <a href="#results-heading" className="rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:border-red-300 hover:text-red-700">Recent results</a>
        <a href="#recent-sports-news" className="rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:border-red-300 hover:text-red-700">Sports news</a>
      </nav>

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
                  Live Matches ({live.length})
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
              <MatchList matches={live} label="Live football matches grouped by competition and date" />
            )}
          </section>

          {/* Upcoming fixtures */}
          <section aria-labelledby="fixtures-heading" className="bg-white rounded-sm border border-gray-200 shadow-sm mb-8">
            <h2 id="fixtures-heading" className="text-sm font-bold uppercase tracking-[0.15em] text-gray-700 px-4 py-3 border-b border-gray-100">
              Upcoming Fixtures ({fixtures.length})
            </h2>
            {fixtures.length === 0 ? (
              <div className="flex items-center justify-center py-10 px-4 text-center" role="status">
                <p className="text-sm text-gray-500">No upcoming fixtures scheduled.</p>
              </div>
            ) : (
              <MatchList matches={fixtures} label="Upcoming football fixtures grouped by competition and date" />
            )}
          </section>

          {/* Recent results */}
          <section aria-labelledby="results-heading" className="bg-white rounded-sm border border-gray-200 shadow-sm mb-8">
            <h2 id="results-heading" className="text-sm font-bold uppercase tracking-[0.15em] text-gray-700 px-4 py-3 border-b border-gray-100">
              Recent Results ({results.length})
            </h2>
            {results.length === 0 ? (
              <div className="flex items-center justify-center py-10 px-4 text-center" role="status">
                <p className="text-sm text-gray-500">No recent results available.</p>
              </div>
            ) : (
              <MatchList matches={results} label="Recent football results grouped by competition and date" />
            )}
          </section>

          <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 sm:p-6" aria-labelledby="football-info-heading">
            <h2 id="football-info-heading" className="mb-3 text-xl font-serif font-bold text-gray-900">
              Football Scores, Fixtures & Match Analysis
            </h2>
            <p className="mb-4 leading-relaxed text-gray-700">
              Use the USA Daily News football score centre to follow live Premier League scores, La Liga results, Bundesliga fixtures, Serie A matches, Ligue 1 games and UEFA Champions League action. Each match row displays the teams, competition, kickoff time or current score and match status. Upcoming kickoff times use your device's local timezone.
            </p>
            <p className="mb-4 leading-relaxed text-gray-700">
              Expand a match to review the available match timeline, goals and cards, player details, team line-ups, match statistics, commentary, stadium information, attendance, officials and previous head-to-head meetings. The depth of each match report depends on the information released by the data provider.
            </p>
            <div className="flex items-start gap-2 text-xs text-gray-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <p className="leading-snug">Scores and match-centre information are supplied by ESPN. The page checks live scores every 30 seconds. Some competitions or fixtures may have delayed or limited coverage.</p>
            </div>
          </section>
          <section className="mt-8" aria-labelledby="football-faq-heading">
            <h2 id="football-faq-heading" className="mb-4 text-xl font-serif font-bold text-gray-900">Football Scores FAQs</h2>
            <div className="space-y-4">
              {FOOTBALL_FAQS.map((entry) => (
                <article key={entry.question} className="border-b border-gray-200 pb-4">
                  <h3 className="mb-1 font-semibold text-gray-900">{entry.question}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{entry.answer}</p>
                </article>
              ))}
            </div>
          </section>        </>
      )}
      <RecentSportsNews />
    </div>
  );
}
