/**
 * Football live scores service — SIMULATED.
 *
 * This project has no real football API integration, so this module
 * generates a deterministic demonstration feed. It simulates matches
 * that are currently in progress, advancing the minute and occasionally
 * updating the score every 30 seconds.
 *
 * Simulated data is never presented as genuine results. The component
 * that consumes this always labels the feed as a simulated demo.
 *
 * If a real free API (e.g. football-data.org) is integrated later,
 * replace `fetchLiveMatches` with the real fetch and keep the same
 * Match shape so the UI component needs no changes.
 */

export type MatchStatus = 'IN_PROGRESS' | 'HALFTIME';

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: MatchStatus;
}

const REFRESH_INTERVAL_MS = 30_000;
const FULL_MATCH_MINUTE = 90;

/** Seed matches used to start the simulation. */
const SEED_MATCHES: Match[] = [
  { id: 'm1', homeTeam: 'ARS', awayTeam: 'MCI', homeScore: 2, awayScore: 1, minute: 74, status: 'IN_PROGRESS' },
  { id: 'm2', homeTeam: 'LIV', awayTeam: 'CHE', homeScore: 1, awayScore: 1, minute: 58, status: 'IN_PROGRESS' },
  { id: 'm3', homeTeam: 'TOT', awayTeam: 'MUN', homeScore: 0, awayScore: 2, minute: 41, status: 'IN_PROGRESS' },
  { id: 'm4', homeTeam: 'BAR', awayTeam: 'RMA', homeScore: 3, awayScore: 2, minute: 82, status: 'IN_PROGRESS' },
  { id: 'm5', homeTeam: 'JUV', awayTeam: 'INT', homeScore: 1, awayScore: 0, minute: 67, status: 'IN_PROGRESS' },
  { id: 'm6', homeTeam: 'BAY', awayTeam: 'DOR', homeScore: 2, awayScore: 2, minute: 33, status: 'IN_PROGRESS' },
];

let liveMatches: Match[] = SEED_MATCHES.map((m) => ({ ...m }));

function advanceMatch(match: Match): Match {
  let { minute, homeScore, awayScore, status } = match;

  if (status === 'HALFTIME') {
    // Resume from halftime into the second half.
    status = 'IN_PROGRESS';
    minute = 46;
  } else {
    minute += 1;

    // Small chance of a goal on each tick (~6%).
    if (Math.random() < 0.06) {
      if (Math.random() < 0.5) homeScore += 1;
      else awayScore += 1;
    }

    // Halftime at minute 45.
    if (minute === 45) status = 'HALFTIME';

    // Match ends at 90 — wrap back to a fresh early match so the demo
    // always has content (real APIs would return an updated list instead).
    if (minute > FULL_MATCH_MINUTE) {
      minute = Math.floor(Math.random() * 15) + 5;
      homeScore = Math.floor(Math.random() * 2);
      awayScore = Math.floor(Math.random() * 2);
      status = 'IN_PROGRESS';
    }
  }

  return { ...match, minute, homeScore, awayScore, status };
}

/**
 * Returns the current set of simulated in-progress matches, advancing
 * each match by one minute on every call. Called once per refresh tick.
 */
export function fetchLiveMatches(): Match[] {
  liveMatches = liveMatches.map(advanceMatch);
  return liveMatches.filter((m) => m.status === 'IN_PROGRESS' || m.status === 'HALFTIME');
}

export { REFRESH_INTERVAL_MS, FULL_MATCH_MINUTE };
