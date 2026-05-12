interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Football-Data.org MCP — soccer competitions, matches, standings
 *
 * Covers 12 major leagues + competitions on the free tier (Premier League,
 * La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga, Brasileirão,
 * MLS, Champions League, European Championship, World Cup).
 *
 * API: https://www.football-data.org/documentation/quickstart
 * Auth: header `X-Auth-Token`. Free tier 10 req/min.
 *
 * Tools:
 * - list_competitions:        all available competitions
 * - get_competition_matches:  matches for a competition, filtered by status/date/matchday
 * - get_competition_standings: league table for a season
 * - get_team:                 team detail with current squad
 * - get_team_matches:         team's matches across competitions
 */


const BASE_URL = 'https://api.football-data.org/v4';

const tools: McpToolExport['tools'] = [
  {
    name: 'list_competitions',
    description:
      'List competitions accessible on your plan. Free tier: 12 majors. Use the returned `code` (e.g., "PL", "PD", "CL") for downstream calls.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_competition_matches',
    description:
      'List matches in a competition. Filter by status (SCHEDULED, LIVE, IN_PLAY, PAUSED, FINISHED, POSTPONED, SUSPENDED, CANCELLED), date range, matchday, stage, or season year.',
    inputSchema: {
      type: 'object',
      properties: {
        competition: {
          type: 'string',
          description: 'Competition code (e.g., "PL" = Premier League, "PD" = La Liga, "CL" = Champions League)',
        },
        status: {
          type: 'string',
          description: 'Match status filter (SCHEDULED | LIVE | IN_PLAY | PAUSED | FINISHED | POSTPONED | SUSPENDED | CANCELLED)',
        },
        date_from: { type: 'string', description: 'YYYY-MM-DD' },
        date_to: { type: 'string', description: 'YYYY-MM-DD' },
        matchday: { type: 'number', description: 'Round number' },
        stage: { type: 'string', description: 'Stage (e.g., "GROUP_STAGE", "QUARTER_FINALS")' },
        season: { type: 'number', description: 'Season start year (e.g., 2025)' },
      },
      required: ['competition'],
    },
  },
  {
    name: 'get_competition_standings',
    description: 'League table for a competition season. Returns total / home / away tables.',
    inputSchema: {
      type: 'object',
      properties: {
        competition: { type: 'string', description: 'Competition code' },
        season: { type: 'number', description: 'Season start year (optional, defaults current)' },
        matchday: { type: 'number', description: 'Standings as of a specific matchday (optional)' },
      },
      required: ['competition'],
    },
  },
  {
    name: 'get_team',
    description: 'Team detail by ID — current squad, coach, competitions, venue.',
    inputSchema: {
      type: 'object',
      properties: { team_id: { type: 'number', description: 'football-data.org numeric team ID' } },
      required: ['team_id'],
    },
  },
  {
    name: 'get_team_matches',
    description: 'A team\'s matches across competitions. Filter by status, date range, competitions, season, or venue.',
    inputSchema: {
      type: 'object',
      properties: {
        team_id: { type: 'number', description: 'Numeric team ID' },
        status: { type: 'string', description: 'Match status filter' },
        date_from: { type: 'string', description: 'YYYY-MM-DD' },
        date_to: { type: 'string', description: 'YYYY-MM-DD' },
        venue: { type: 'string', description: 'HOME | AWAY' },
        season: { type: 'number', description: 'Season start year' },
        limit: { type: 'number', description: 'Cap matches returned (default 50)' },
      },
      required: ['team_id'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = (args._apiKey as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error(
      'Football-Data.org requires an API key. Contact the operator about platform credentials, or BYO via ?_apiKey=<token> after registering at https://www.football-data.org/client/register.',
    );
  }
  switch (name) {
    case 'list_competitions':
      return listCompetitions(apiKey);
    case 'get_competition_matches':
      return getCompetitionMatches(apiKey, args);
    case 'get_competition_standings':
      return getCompetitionStandings(apiKey, args);
    case 'get_team':
      return getTeam(apiKey, reqNum(args, 'team_id', '64 (Liverpool)'));
    case 'get_team_matches':
      return getTeamMatches(apiKey, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function reqNum(args: Record<string, unknown>, key: string, example: string): number {
  const v = args[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`Required argument "${key}" must be a number. Example: ${example}.`);
  }
  return v;
}

async function fdFetch<T>(apiKey: string, path: string, params?: URLSearchParams): Promise<T> {
  const url = `${BASE_URL}${path}${params?.toString() ? `?${params}` : ''}`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': apiKey, Accept: 'application/json' },
  });
  if (res.status === 400) {
    const body = await res.text();
    throw new Error(`Football-Data: bad request — ${body.slice(0, 200)}`);
  }
  if (res.status === 403) throw new Error('Football-Data: competition/resource not available on your tier (HTTP 403)');
  if (res.status === 429) throw new Error('Football-Data: rate-limit hit (free tier is 10 req/min)');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Football-Data error: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

interface Competition {
  id?: number;
  area?: { id?: number; name?: string; code?: string };
  name?: string;
  code?: string;
  type?: string;
  emblem?: string;
  plan?: string;
  currentSeason?: {
    startDate?: string;
    endDate?: string;
    currentMatchday?: number;
    winner?: { id?: number; name?: string } | null;
  };
}

async function listCompetitions(apiKey: string) {
  const data = await fdFetch<{ count?: number; competitions?: Competition[] }>(apiKey, '/competitions');
  return {
    count: data.count ?? data.competitions?.length ?? 0,
    competitions: (data.competitions ?? []).map((c) => ({
      id: c.id ?? null,
      code: c.code ?? null,
      name: c.name ?? null,
      type: c.type ?? null,
      area: c.area?.name ?? null,
      plan: c.plan ?? null,
      emblem: c.emblem ?? null,
      current_season_start: c.currentSeason?.startDate ?? null,
      current_season_end: c.currentSeason?.endDate ?? null,
      current_matchday: c.currentSeason?.currentMatchday ?? null,
    })),
  };
}

interface MatchTeam {
  id?: number;
  name?: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

interface Match {
  id?: number;
  utcDate?: string;
  status?: string;
  matchday?: number;
  stage?: string;
  group?: string | null;
  competition?: { id?: number; name?: string; code?: string };
  season?: { startDate?: string; endDate?: string };
  homeTeam?: MatchTeam;
  awayTeam?: MatchTeam;
  score?: {
    winner?: string | null;
    duration?: string;
    fullTime?: { home?: number | null; away?: number | null };
    halfTime?: { home?: number | null; away?: number | null };
  };
  venue?: string;
}

function normalizeMatch(m: Match) {
  return {
    id: m.id ?? null,
    utc_date: m.utcDate ?? null,
    status: m.status ?? null,
    matchday: m.matchday ?? null,
    stage: m.stage ?? null,
    group: m.group ?? null,
    competition: m.competition?.name ?? null,
    competition_code: m.competition?.code ?? null,
    home: m.homeTeam?.name ?? null,
    home_id: m.homeTeam?.id ?? null,
    away: m.awayTeam?.name ?? null,
    away_id: m.awayTeam?.id ?? null,
    score_full_time: m.score?.fullTime
      ? `${m.score.fullTime.home ?? '-'}-${m.score.fullTime.away ?? '-'}`
      : null,
    score_half_time: m.score?.halfTime
      ? `${m.score.halfTime.home ?? '-'}-${m.score.halfTime.away ?? '-'}`
      : null,
    winner: m.score?.winner ?? null,
    venue: m.venue ?? null,
  };
}

function buildMatchFilters(args: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  if (args.status) params.set('status', String(args.status));
  if (args.date_from) params.set('dateFrom', String(args.date_from));
  if (args.date_to) params.set('dateTo', String(args.date_to));
  if (args.matchday) params.set('matchday', String(args.matchday));
  if (args.stage) params.set('stage', String(args.stage));
  if (args.season) params.set('season', String(args.season));
  if (args.venue) params.set('venue', String(args.venue));
  if (args.limit) params.set('limit', String(args.limit));
  return params;
}

async function getCompetitionMatches(apiKey: string, args: Record<string, unknown>) {
  const code = String(args.competition).toUpperCase();
  const params = buildMatchFilters(args);
  const data = await fdFetch<{ count?: number; matches?: Match[] }>(
    apiKey,
    `/competitions/${encodeURIComponent(code)}/matches`,
    params,
  );
  return {
    competition: code,
    count: data.count ?? data.matches?.length ?? 0,
    matches: (data.matches ?? []).map(normalizeMatch),
  };
}

interface StandingsRow {
  position?: number;
  team?: MatchTeam;
  playedGames?: number;
  form?: string;
  won?: number;
  draw?: number;
  lost?: number;
  points?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
}

async function getCompetitionStandings(apiKey: string, args: Record<string, unknown>) {
  const code = String(args.competition).toUpperCase();
  const params = new URLSearchParams();
  if (args.season) params.set('season', String(args.season));
  if (args.matchday) params.set('matchday', String(args.matchday));

  const data = await fdFetch<{
    competition?: Competition;
    standings?: { stage?: string; type?: string; group?: string | null; table?: StandingsRow[] }[];
  }>(apiKey, `/competitions/${encodeURIComponent(code)}/standings`, params);

  return {
    competition: data.competition?.name ?? code,
    standings: (data.standings ?? []).map((s) => ({
      stage: s.stage ?? null,
      type: s.type ?? null,
      group: s.group ?? null,
      table: (s.table ?? []).map((r) => ({
        position: r.position ?? null,
        team: r.team?.name ?? null,
        team_id: r.team?.id ?? null,
        played: r.playedGames ?? null,
        won: r.won ?? null,
        draw: r.draw ?? null,
        lost: r.lost ?? null,
        gf: r.goalsFor ?? null,
        ga: r.goalsAgainst ?? null,
        gd: r.goalDifference ?? null,
        points: r.points ?? null,
        form: r.form ?? null,
      })),
    })),
  };
}

interface SquadMember {
  id?: number;
  name?: string;
  position?: string;
  dateOfBirth?: string;
  nationality?: string;
}

interface TeamRecord {
  id?: number;
  name?: string;
  shortName?: string;
  tla?: string;
  crest?: string;
  address?: string;
  website?: string;
  founded?: number;
  clubColors?: string;
  venue?: string;
  area?: { name?: string };
  coach?: { id?: number; name?: string; nationality?: string };
  squad?: SquadMember[];
  runningCompetitions?: Competition[];
}

async function getTeam(apiKey: string, teamId: number) {
  const data = await fdFetch<TeamRecord>(apiKey, `/teams/${teamId}`);
  return {
    id: data.id ?? null,
    name: data.name ?? null,
    short_name: data.shortName ?? null,
    tla: data.tla ?? null,
    country: data.area?.name ?? null,
    address: data.address ?? null,
    website: data.website ?? null,
    founded: data.founded ?? null,
    colors: data.clubColors ?? null,
    venue: data.venue ?? null,
    coach: data.coach?.name ?? null,
    coach_nationality: data.coach?.nationality ?? null,
    crest: data.crest ?? null,
    squad: (data.squad ?? []).map((p) => ({
      id: p.id ?? null,
      name: p.name ?? null,
      position: p.position ?? null,
      dob: p.dateOfBirth ?? null,
      nationality: p.nationality ?? null,
    })),
    running_competitions: (data.runningCompetitions ?? []).map((c) => c.name).filter(Boolean),
  };
}

async function getTeamMatches(apiKey: string, args: Record<string, unknown>) {
  const teamId = reqNum(args, 'team_id', '64 (Liverpool)');
  const params = buildMatchFilters(args);
  const data = await fdFetch<{ count?: number; matches?: Match[] }>(
    apiKey,
    `/teams/${teamId}/matches`,
    params,
  );
  return {
    team_id: teamId,
    count: data.count ?? data.matches?.length ?? 0,
    matches: (data.matches ?? []).map(normalizeMatch),
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
