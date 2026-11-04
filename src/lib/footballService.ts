/**
 * Football data service — browser requests are handled by our Cloudflare
 * Worker at /api/football. The API key stays in a Cloudflare Worker secret
 * and is never exposed to the browser.
 *
 * The Cloudflare Worker normalizes ESPN scoreboard and match-centre data.
 * Provider availability determines which details are present for each fixture.
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
  homeLogo?: string | null;
  awayLogo?: string | null;
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
  homeTeam?: { name: string; tla: string; crest?: string; logo?: string };
  awayTeam?: { name: string; tla: string; crest?: string; logo?: string };
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
    homeLogo: raw.homeTeam?.logo ?? raw.homeTeam?.crest ?? null,
    awayLogo: raw.awayTeam?.logo ?? raw.awayTeam?.crest ?? null,
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

export interface SoccerMatchDetails {
  header?: {
    competitions?: Array<{
      competitors?: Array<{
        homeAway?: string;
        team?: { displayName?: string; name?: string; logo?: string };
        score?: string;
        winner?: boolean;
        statistics?: Array<{ name?: string; displayName?: string; displayValue?: string }>;
      }>;
      status?: { type?: { detail?: string; shortDetail?: string; state?: string } };
    }>;
  };
  keyEvents?: Array<{
    id?: string;
    clock?: { displayValue?: string };
    type?: { text?: string; abbreviation?: string };
    text?: string;
    team?: { displayName?: string };
    participants?: Array<{ athlete?: { displayName?: string }; type?: string }>;
  }>;
  commentary?: Array<{ text?: string; time?: { displayValue?: string } }>;
  boxscore?: {
    teams?: Array<{
      team?: { displayName?: string; logo?: string };
      statistics?: Array<{ name?: string; displayName?: string; displayValue?: string }>;
    }>;
  };
  rosters?: Array<{
    team?: { displayName?: string; logo?: string };
    roster?: Array<{ athlete?: { displayName?: string }; starter?: boolean; position?: { abbreviation?: string } }>;
  }>;
  gameInfo?: { venue?: { fullName?: string; address?: { city?: string; country?: string } }; attendance?: number; officials?: Array<{ fullName?: string }> };
  seasonseries?: Array<{ summary?: string; events?: Array<{ id?: string; date?: string; name?: string; competitions?: Array<{ competitors?: Array<{ score?: string; team?: { displayName?: string } }> }> }> }>;
  news?: { articles?: Array<{ headline?: string; description?: string; links?: { web?: { href?: string } }; published?: string }> };
  [key: string]: unknown;
}

export interface SportsNewsArticle {
  id: number;
  title: string;
  category: string;
  image_url: string | null;
  seo_description: string | null;
  created_at: string;
  source_url: string | null;
}

export async function fetchMatchDetails(competitionCode: string, matchId: number): Promise<{ details?: SoccerMatchDetails; error?: string }> {
  try {
    const details = await fetchProxy(`match/${competitionCode}/${matchId}`) as SoccerMatchDetails;
    return { details };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Match details unavailable.' };
  }
}

export async function fetchSportsNews(): Promise<{ articles?: SportsNewsArticle[]; error?: string }> {
  try {
    const response = await fetch('/api/sports-news');
    const json = await response.json() as { data?: { articles?: SportsNewsArticle[] }; error?: string };
    if (!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
    return { articles: json.data?.articles ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sports news unavailable.' };
  }
}

/** Fetch the list of competitions supported by the Worker. */
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

// Competitions currently enabled by the ESPN scoreboard adapter.
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
