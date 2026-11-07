import { useCallback, useEffect, useState } from 'react';
import { Clock, Radio, RefreshCw } from 'lucide-react';
import { fetchProGames, type ProGame, type ProLeague } from '@/lib/proSportsService';

const REFRESH_MS = 30_000;

function GameRows({ games }: { games: ProGame[] }) {
  if (!games.length) return <p className="px-4 py-8 text-center text-sm text-gray-500">No games in this section right now.</p>;
  return <ul className="divide-y divide-gray-100">
    {games.map((game) => {
      const live = /in progress|halftime|end of|quarter|period|live/i.test(game.status + ' ' + game.detail);
      const complete = /final|completed/i.test(game.status);
      return <li key={game.id} className="flex items-center gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {game.awayLogo && <img src={game.awayLogo} alt="" className="h-6 w-6 object-contain" loading="lazy" />}
            <span className="truncate text-sm font-semibold text-gray-900">{game.away}</span>
            <strong className="ml-auto tabular-nums text-sm text-gray-900">{game.awayScore ?? '—'}</strong>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {game.homeLogo && <img src={game.homeLogo} alt="" className="h-6 w-6 object-contain" loading="lazy" />}
            <span className="truncate text-sm font-semibold text-gray-900">{game.home}</span>
            <strong className="ml-auto tabular-nums text-sm text-gray-900">{game.homeScore ?? '—'}</strong>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">{new Date(game.date).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
        </div>
        <span className={`w-28 shrink-0 text-right text-xs font-semibold ${live ? 'text-red-700' : 'text-gray-500'}`}>
          {live && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-600" />}
          {live ? game.detail || game.status : complete ? 'Final' : game.detail || game.status}
        </span>
      </li>;
    })}
  </ul>;
}

export interface ProSportsCounts { live: number; upcoming: number; results: number }

export function ProSportsScores({ onCountsChange }: { onCountsChange?: (counts: ProSportsCounts) => void }) {
  const [league, setLeague] = useState<ProLeague>('nba');
  const [games, setGames] = useState<ProGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState('');
  const refresh = useCallback(async () => {
    const [result, otherResult] = await Promise.all([
      fetchProGames(league),
      fetchProGames(league === 'nba' ? 'nfl' : 'nba'),
    ]);
    setGames(result.games);
    const allGames = [...result.games, ...otherResult.games];
    const allLive = allGames.filter((game) => /in progress|halftime|end of|quarter|period|live/i.test(game.status + ' ' + game.detail));
    const allCompleted = allGames.filter((game) => /final|completed/i.test(game.status));
    onCountsChange?.({ live: allLive.length, results: allCompleted.length, upcoming: allGames.length - allLive.length - allCompleted.length });
    setError(result.error || '');
    setUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setLoading(false);
  }, [league, onCountsChange]);
  useEffect(() => {
    setLoading(true);
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const live = games.filter((game) => /in progress|halftime|end of|quarter|period|live/i.test(game.status + ' ' + game.detail));
  const completed = games.filter((game) => /final|completed/i.test(game.status));
  const upcoming = games.filter((game) => !live.includes(game) && !completed.includes(game));

  return <section className="mb-8 overflow-hidden rounded-sm border border-gray-200 bg-white shadow-sm" aria-labelledby="us-sports-scores">
    <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 id="us-sports-scores" className="font-serif text-xl font-bold text-gray-900">US Sports Live Scores</h2>
          <p className="mt-1 text-xs text-gray-500">NBA basketball and NFL American football</p></div>
        <span className="flex items-center gap-1 text-[11px] text-gray-400"><Clock className="h-3 w-3" /> Updated {updated || '—'}</span>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => setLeague('nba')} aria-pressed={league === 'nba'} className={`rounded-full px-4 py-2 text-sm font-semibold ${league === 'nba' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>NBA</button>
        <button type="button" onClick={() => setLeague('nfl')} aria-pressed={league === 'nfl'} className={`rounded-full px-4 py-2 text-sm font-semibold ${league === 'nfl' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>NFL</button>
        <button type="button" onClick={() => { setLoading(true); void refresh(); }} className="ml-auto inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700"><RefreshCw className="h-3 w-3" /> Refresh</button>
      </div>
    </div>
    {loading ? <p className="px-4 py-8 text-sm text-gray-500">Loading {league.toUpperCase()} scores…</p> : error ? <p className="px-4 py-8 text-sm text-amber-700">Scores are temporarily unavailable: {error}</p> : <>
      <section aria-label="Live games">
        <h3 className="flex items-center gap-2 border-b border-gray-100 bg-red-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-800"><Radio className="h-3.5 w-3.5" /> Live now ({live.length})</h3>
        <GameRows games={live} />
      </section>
      <section aria-label="Upcoming games">
        <h3 className="border-y border-gray-100 bg-gray-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-700">Upcoming games ({upcoming.length})</h3>
        <GameRows games={upcoming} />
      </section>
      <section aria-label="Recent results">
        <h3 className="border-y border-gray-100 bg-gray-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-700">Recent results ({completed.length})</h3>
        <GameRows games={completed} />
      </section>
    </>}
    <p className="border-t border-gray-100 px-4 py-3 text-[11px] text-gray-400">Scoreboard data supplied by ESPN. Scores refresh every 30 seconds; update timing depends on the data provider.</p>
  </section>;
}
