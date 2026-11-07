export type ProLeague = 'nba' | 'nfl';
export interface ProGame {
  id: string;
  name: string;
  away: string;
  home: string;
  awayLogo?: string;
  homeLogo?: string;
  awayScore?: string;
  homeScore?: string;
  status: string;
  detail: string;
  date: string;
}
export interface ProSportsResult { games: ProGame[]; error?: string }

export async function fetchProGames(league: ProLeague): Promise<ProSportsResult> {
  try {
    const response = await fetch(`/api/pro-sports?league=${league}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const data = await response.json() as ProSportsResult;
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  } catch (error) {
    return { games: [], error: error instanceof Error ? error.message : 'Scores are temporarily unavailable.' };
  }
}
