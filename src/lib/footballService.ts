/**
 * Football data service — browser requests are handled by our Cloudflare
 * Worker at /api/football. The API key stays in a Cloudflare Worker secret
 * and is never exposed to the browser.
 *
 * football-data.org plan limits determine which competitions and match
 * details are available for the account using the API key.
 */

const PROXY_URL = '/api/football';

export type MatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'SUSPENDED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'AWARDED';

export interface FootballMatch {
  id: number;
  competition: string;
  competitionCode: string;
  homeTeam: string;
  homeTla: string;
  awayTeam: string;
  awayTla: string;
  homeScore: number | null;
  awayScore: number | null;
  minute: number | null;
  status: MatchStatus;
  utcDate: string;
}

export interface Competition {
  id: number;
  name: string;
  code: string;
}

export interface FootballDataResult {
  matches?: FootballMatch[];
  competitions?: Competition[];
  error?: string;
}

interface RawMatch {
  id: number;
  status: string;
  utcDate: string;
  minute: number | null;
  competition?: { name: string; code: string };
  homeTeam?: { name: string; tla: string };
  awayTeam?: { name: string; tla: string };
  score?: {
    fullTime?: { home: number | null; away: number | null };
    halfTime?: { home: number | null; away: number | null };
  };
}

function mapMatch(raw: RawMatch): FootballMatch {
  return {
    id: raw.id,
    competition: raw.competition?.name ?? 'Unknown',
    competitionCode: raw.competition?.code ?? '',
    homeTeam: raw.homeTeam?.name ?? 'TBD',
    homeTla: raw.homeTeam?.tla ?? raw.homeTeam?.name?.slice(0, 3).toUpperCase() ?? '???',
    awayTeam: raw.awayTeam?.name ?? 'TBD',
    awayTla: raw.awayTeam?.tla ?? raw.awayTeam?.name?.slice(0, 3).toUpperCase() ?? '???',
    homeScore: raw.score?.fullTime?.home ?? null,
    awayScore: raw.score?.fullTime?.away ?? null,
    minute: raw.minute,
    status: raw.status as MatchStatus,
    utcDate: raw.utcDate,
  };
}

async function fetchProxy(path: string): Promise<unknown> {
  const url = `${PROXY_URL}?path=${encodeURIComponent(path)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const json = await res.json();
    if (!res.ok) {
      throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return (json as { data: unknown }).data;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch all matches for the given competition code, optionally filtered by status. */
export async function fetchMatches(
  competitionCode?: string,
  status?: 'LIVE' | 'SCHEDULED' | 'TIMED' | 'FINISHED'
): Promise<FootballDataResult> {
  try {
    const base = competitionCode
      ? `competitions/${competitionCode}/matches`
      : 'matches';
    const query = status ? `?status=${status}` : '';
    const data = await fetchProxy(`${base}${query}`) as { matches?: RawMatch[] };
    if (!data?.matches) return { matches: [] };
    return { matches: data.matches.map(mapMatch) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Football data unavailable.';
    return { error: message };
  }
}

/** Fetch the list of competitions available on the free tier. */
export async function fetchCompetitions(): Promise<FootballDataResult> {
  try {
    const data = await fetchProxy('competitions') as {
      competitions?: Array<{ id: number; name: string; code: string }>;
    };
    if (!data?.competitions) return { competitions: [] };
    return { competitions: data.competitions.map((c) => ({ id: c.id, name: c.name, code: c.code })) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Football data unavailable.';
    return { error: message };
  }
}

// Competitions available on the football-data.org free tier.
export const FREE_COMPETITIONS: Competition[] = [
  { id: 2021, name: 'Premier League', code: 'PL' },
  { id: 2014, name: 'La Liga', code: 'PD' },
  { id: 2002, name: 'Bundesliga', code: 'BL1' },
  { id: 2019, name: 'Serie A', code: 'SA' },
  { id: 2015, name: 'Ligue 1', code: 'FL1' },
  { id: 2001, name: 'UEFA Champions League', code: 'CL' },
];

export const REFRESH_INTERVAL_MS = 30_000;

/** Statuses that count as "in progress" (live). */
export const LIVE_STATUSES: MatchStatus[] = ['IN_PLAY', 'PAUSED'];

export function isLive(status: MatchStatus): boolean {
  return LIVE_STATUSES.includes(status);
}

export function statusLabel(status: MatchStatus, minute: number | null): string {
  switch (status) {
    case 'IN_PLAY': return minute ? `${minute}'` : "Live";
    case 'PAUSED': return 'HT';
    case 'FINISHED': return 'FT';
    case 'SCHEDULED':
    case 'TIMED': return '';
    case 'SUSPENDED': return 'Suspended';
    case 'POSTPONED': return 'Postponed';
    case 'CANCELLED': return 'Cancelled';
    case 'AWARDED': return 'Awarded';
    default: return '';
  }
}
