import { useEffect, useState } from 'react';
import { Radio, Info } from 'lucide-react';
import {
  fetchMatches, REFRESH_INTERVAL_MS, statusLabel, isLive,
  type FootballMatch,
} from '@/lib/footballService';

export function FootballLiveScores() {
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // 'LIVE' pseudo-status fetches IN_PLAY + PAUSED matches.
      const result = await fetchMatches(undefined, 'LIVE');
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setMatches([]);
      } else {
        setMatches(result.matches ?? []);
        setError(null);
      }
      setLoading(false);
    };

    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const hasMatches = matches.length > 0;

  return (
    <section
      aria-labelledby="football-scores-title"
      className="bg-white rounded-sm border border-gray-200 shadow-sm p-4 sm:p-5 flex flex-col"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex items-center justify-center shrink-0">
            <span className="absolute inset-0 rounded-full bg-red-600/30 animate-ping" style={{ animationDuration: '2.5s' }} />
            <Radio className="relative h-3.5 w-3.5 text-red-700" aria-hidden="true" />
          </span>
          <h2 id="football-scores-title" className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500 truncate">
            Live Football Scores
          </h2>
        </div>
        <a href="#/football" className="text-[10px] font-medium uppercase tracking-wider text-blue-700 hover:underline shrink-0">
          View all
        </a>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8" aria-label="Loading live football scores">
          <div className="h-4 w-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" aria-hidden="true" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 py-4 px-2" role="status">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm text-gray-600 leading-snug">{error}</p>
        </div>
      )}

      {!loading && !error && !hasMatches && (
        <div className="flex items-center justify-center py-8 px-4 text-center" role="status">
          <p className="text-sm text-gray-500 leading-relaxed">
            No live matches currently in progress. Check back during game times.
          </p>
        </div>
      )}

      {!loading && !error && hasMatches && (
        <ul
          className="divide-y divide-gray-100 overflow-y-auto max-h-44"
          aria-label="Live football matches in progress"
        >
          {matches.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 py-2.5 text-sm"
              role="group"
              aria-label={`${m.homeTla} vs ${m.awayTla}, score ${m.homeScore} to ${m.awayScore}, ${statusLabel(m.status, m.minute)}`}
            >
              <span className="font-semibold text-gray-900 w-10 text-right tabular-nums">{m.homeTla}</span>
              <span className="font-serif font-bold text-gray-900 tabular-nums px-1.5">
                {m.homeScore} - {m.awayScore}
              </span>
              <span className="font-semibold text-gray-900 w-10 tabular-nums">{m.awayTla}</span>
              <span className="ml-auto text-xs font-medium text-red-700 tabular-nums shrink-0" aria-label={`Match minute ${statusLabel(m.status, m.minute)}`}>
                {statusLabel(m.status, m.minute)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
