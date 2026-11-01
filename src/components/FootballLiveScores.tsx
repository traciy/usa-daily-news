import { useEffect, useState } from 'react';
import { Radio, Info } from 'lucide-react';
import { fetchLiveMatches, REFRESH_INTERVAL_MS, type Match } from '@/lib/footballService';

const HALFTIME_LABEL = 'HT';

function minuteLabel(match: Match): string {
  return match.status === 'HALFTIME' ? HALFTIME_LABEL : `${match.minute}'`;
}

export function FootballLiveScores() {
  const [matches, setMatches] = useState<Match[]>(() => fetchLiveMatches());

  useEffect(() => {
    const interval = setInterval(() => {
      setMatches(fetchLiveMatches());
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

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
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
          Simulated
        </span>
      </div>

      {matches.length === 0 ? (
        <div className="flex items-center justify-center py-8 px-4 text-center" role="status">
          <p className="text-sm text-gray-500 leading-relaxed">
            No live matches currently in progress. Check back during game times.
          </p>
        </div>
      ) : (
        <ul
          className="divide-y divide-gray-100 overflow-y-auto max-h-44"
          aria-label="Live football matches in progress"
        >
          {matches.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 py-2.5 text-sm"
              role="group"
              aria-label={`${m.homeTeam} vs ${m.awayTeam}, score ${m.homeScore} to ${m.awayScore}, minute ${minuteLabel(m)}`}
            >
              <span className="font-semibold text-gray-900 w-10 text-right tabular-nums">{m.homeTeam}</span>
              <span className="font-serif font-bold text-gray-900 tabular-nums px-1.5">
                {m.homeScore} - {m.awayScore}
              </span>
              <span className="font-semibold text-gray-900 w-10 tabular-nums">{m.awayTeam}</span>
              <span className="ml-auto text-xs font-medium text-red-700 tabular-nums shrink-0" aria-label={`Match minute ${minuteLabel(m)}`}>
                {minuteLabel(m)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-start gap-1.5 pt-2 border-t border-gray-100">
        <Info className="h-3 w-3 text-gray-300 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-[10px] text-gray-400 leading-snug">
          Simulated demo feed for illustration. Not real match data.
        </p>
      </div>
    </section>
  );
}
