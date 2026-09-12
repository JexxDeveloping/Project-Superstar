/**
 * ReleaseCalendarEngine — the industry-wide release calendar (Part 1 "Release Calendar", Part 3
 * behavioural spec).
 *
 * Owns: the 52-week market-size tables per market, the named holiday windows and how genres react
 * to them, audience overlap between films (the basis of competition), the studio's choice of a
 * release date at wrap (market size × genre fit − expected competition), and date bumps when a
 * much bigger film lands on a smaller one's week — rarely, always with a news line, and it can
 * happen to the player's film.
 *
 * No money is simulated here; BoxOfficeEngine reads these tables.
 */
import {
  BUDGET_TIERS, clamp, type BudgetTier, type Genre, type GameState, type Id, type Movie, type WorkingSet, markDirty,
} from '../core/GameState';
import { rngFor, type Rng } from '../core/RNG';
import type { EventBus } from '../core/EventBus';
import { WEEKS_PER_YEAR } from '../sim/ActorEngine';
import { formatDate } from '../core/TimeEngine';
import { MARKETING_RATIO } from '../gen/MovieGen';

export type Market = 'domestic' | 'international';

// ---------------------------------------------------------------------------
// Market size by week of year (4-4-5 calendar: Jan 0–3, Feb 4–7, Mar 8–12, Apr 13–16, May 17–20,
// Jun 21–25, Jul 26–29, Aug 30–33, Sep 34–38, Oct 39–42, Nov 43–46, Dec 47–51). 1.0 = an average week.
// ---------------------------------------------------------------------------

const DOMESTIC: number[] = [
  1.10, 0.85, 0.85, 0.90,             // Jan: holiday hangover, then the January dead zone
  0.95, 1.10, 1.05, 0.95,             // Feb: Valentine's (wk 2), Presidents' Day
  0.95, 1.00, 1.10, 1.10, 1.00,       // Mar: Spring Break (wks 3–4)
  1.05, 1.00, 0.95, 0.95,             // Apr
  1.00, 1.05, 1.10, 1.25,             // May: summer starts, Memorial Day (wk 4)
  1.20, 1.20, 1.20, 1.20, 1.20,       // Jun
  1.40, 1.25, 1.20, 1.15,             // Jul: July 4 (wk 1)
  1.10, 1.05, 0.95, 0.90,             // Aug: summer fades
  0.80, 0.80, 0.85, 0.85, 0.90,       // Sep: dead zone
  0.95, 0.95, 1.00, 1.10,             // Oct: Halloween (wk 4)
  1.00, 1.00, 1.05, 1.35,             // Nov: Thanksgiving (wk 4)
  0.85, 0.90, 1.05, 1.60, 1.50,       // Dec: early-December lull, then Christmas (wks 4–5)
];
const INTERNATIONAL: number[] = [
  1.20, 0.95, 0.95, 0.95,
  1.15, 1.15, 1.00, 0.95,             // Lunar New Year season lifts February abroad
  0.95, 1.00, 1.00, 1.00, 1.00,
  1.05, 1.00, 0.95, 0.95,
  1.00, 1.00, 1.05, 1.00,             // US holidays mean little abroad
  1.10, 1.10, 1.10, 1.10, 1.10,
  1.15, 1.15, 1.15, 1.10,
  1.10, 1.05, 1.00, 0.95,
  0.90, 0.90, 0.90, 0.95, 0.95,
  1.00, 1.00, 1.00, 1.05,
  1.00, 1.00, 1.00, 1.00,
  0.90, 0.95, 1.10, 1.40, 1.40,       // Christmas plays everywhere
];

export function weekOfYear(week: number): number {
  return ((week % WEEKS_PER_YEAR) + WEEKS_PER_YEAR) % WEEKS_PER_YEAR;
}

/** Relative size of the whole market that calendar week (1.0 = average). */
export function marketSize(market: Market, week: number): number {
  return (market === 'domestic' ? DOMESTIC : INTERNATIONAL)[weekOfYear(week)];
}

// ---------------------------------------------------------------------------
// Named windows and how genres react to them
// ---------------------------------------------------------------------------

export interface ReleaseWindow {
  name: string;
  weeks: number[]; // weeks of year
  /** Genre multipliers on the opening/holdover inside the window (1 = neutral). */
  genres: Partial<Record<Genre, number>>;
  /** Show it as the headline window on the calendar (broad seasons stay in the background). */
  headline: boolean;
}

const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const WINDOWS: ReleaseWindow[] = [
  { name: "Valentine's", weeks: [5], genres: { Romance: 1.35, Comedy: 1.1, Horror: 0.9 }, headline: true },
  { name: 'Spring Break', weeks: [10, 11], genres: { Family: 1.15, Comedy: 1.1, Action: 1.05 }, headline: true },
  { name: 'Memorial Day', weeks: [20], genres: { Action: 1.15, 'Science Fiction': 1.1, Fantasy: 1.1 }, headline: true },
  { name: 'July 4', weeks: [26], genres: { Action: 1.2, 'Science Fiction': 1.1, Fantasy: 1.1, Family: 1.05 }, headline: true },
  { name: 'Summer', weeks: range(21, 33), genres: { Action: 1.12, Fantasy: 1.12, 'Science Fiction': 1.12, Comedy: 1.08, Family: 1.1, Drama: 0.92, Historical: 0.9 }, headline: false },
  { name: 'Halloween', weeks: [41, 42], genres: { Horror: 1.4, Thriller: 1.1, Mystery: 1.05, Romance: 0.9, Family: 0.95 }, headline: true },
  { name: 'October', weeks: [39, 40], genres: { Horror: 1.15, Thriller: 1.05 }, headline: false },
  { name: 'Thanksgiving', weeks: [46], genres: { Family: 1.3, Musical: 1.15, Drama: 1.1, Horror: 0.85 }, headline: true },
  { name: 'Awards season', weeks: [43, 44, 45, 47, 48, 49], genres: { Drama: 1.1, Historical: 1.1, Musical: 1.05 }, headline: false },
  { name: 'Christmas', weeks: [50, 51], genres: { Family: 1.35, Musical: 1.2, Drama: 1.15, Historical: 1.15, Fantasy: 1.1, Horror: 0.8 }, headline: true },
];

/** Windows containing a week (broad seasons included). */
export function windowsFor(week: number): ReleaseWindow[] {
  const w = weekOfYear(week);
  return WINDOWS.filter((r) => r.weeks.includes(w));
}

/** The headline window name for a week, if any ("Christmas", "July 4"…), else the season, else undefined. */
export function windowName(week: number): string | undefined {
  const ws = windowsFor(week);
  return (ws.find((r) => r.headline) ?? ws[0])?.name;
}

/** How much a film's genres like this calendar week (romance at Valentine's, horror at Halloween…). */
export function genreWindowFactor(genres: readonly Genre[], week: number): number {
  let f = 1;
  for (const r of windowsFor(week)) {
    let sum = 0;
    for (const g of genres) sum += r.genres[g] ?? 1;
    f *= sum / genres.length;
  }
  return f;
}

// ---------------------------------------------------------------------------
// Audience overlap — the basis of competition
// ---------------------------------------------------------------------------

const AFFINITY: Partial<Record<Genre, Partial<Record<Genre, number>>>> = {
  Action: { 'Science Fiction': 0.7, Fantasy: 0.7, Thriller: 0.7, Crime: 0.5, Western: 0.5, Sports: 0.4 },
  Comedy: { Romance: 0.6, Family: 0.6, Sports: 0.5, Musical: 0.4 },
  Drama: { Romance: 0.6, Historical: 0.6, Crime: 0.6, Mystery: 0.6, Sports: 0.5, Musical: 0.5 },
  Horror: { Thriller: 0.6, Mystery: 0.6, 'Science Fiction': 0.4 },
  Family: { Fantasy: 0.6, Musical: 0.5 },
  Fantasy: { 'Science Fiction': 0.6 },
  Thriller: { Crime: 0.7, Mystery: 0.7 },
  Historical: { Western: 0.5 },
};

function affinity(a: Genre, b: Genre): number {
  if (a === b) return 1;
  return AFFINITY[a]?.[b] ?? AFFINITY[b]?.[a] ?? 0.25;
}

/** Share of audience two films fight over (0.25 floor: everyone competes a little for the general audience). */
export function audienceOverlap(a: Pick<Movie, 'genres' | 'budgetTier'>, b: Pick<Movie, 'genres' | 'budgetTier'>): number {
  let best = 0;
  for (const ga of a.genres) for (const gb of b.genres) best = Math.max(best, affinity(ga, gb));
  const tierGap = Math.abs(BUDGET_TIERS.indexOf(a.budgetTier) - BUDGET_TIERS.indexOf(b.budgetTier));
  return best * (1 - tierGap * 0.08);
}

/**
 * Competitive pressure on `film` (of size `mySize`) from rivals of the given sizes: overlap-weighted,
 * scaled by how much bigger each rival is. 0 = an empty week; ~1 = one equal-sized rival for the same
 * audience; larger when several big films crowd in.
 */
export function competitionPressure(film: Pick<Movie, 'genres' | 'budgetTier'>, mySize: number, rivals: { movie: Pick<Movie, 'genres' | 'budgetTier'>; size: number }[]): number {
  let p = 0;
  for (const r of rivals) {
    const ratio = mySize > 0 ? Math.sqrt(r.size / mySize) : 1;
    p += audienceOverlap(film, r.movie) * clamp(ratio, 0.2, 2.2);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/** How far past the earliest possible week a studio will look for a better date. */
const LOOKAHEAD: Record<BudgetTier, number> = {
  'Micro Indie': 8, 'Indie': 8, 'Small Studio': 10, 'Medium': 12, 'Large': 16, 'Tentpole': 22,
};

/** A rough size proxy for a film not yet opened (the calendar must not depend on the box office engine). */
export function sizeProxy(m: Pick<Movie, 'budget' | 'marketingBudget'>): number {
  return m.budget * 0.5 + m.marketingBudget;
}

/** Films holding a date on the calendar (in post, not yet opened). */
export function scheduledFilms(ws: WorkingSet, exclude?: Id): Movie[] {
  const out: Movie[] = [];
  for (const m of ws.movies.values()) if (m.status === 'post-production' && m.releaseWeek !== undefined && m.id !== exclude) out.push(m);
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** How attractive a week is for a film: market × genre fit ÷ expected competition, minus a wait penalty. */
export function dateScore(movie: Movie, week: number, earliest: number, scheduled: Movie[]): number {
  const size = marketSize('domestic', week) * genreWindowFactor(movie.genres, week);
  const rivals: { movie: Movie; size: number }[] = [];
  let bigOpener = false;
  for (const r of scheduled) {
    const d = Math.abs((r.releaseWeek ?? 0) - week);
    if (d > 1) continue;
    rivals.push({ movie: r, size: sizeProxy(r) * (d === 0 ? 1 : 0.5) });
    if (d === 0 && BUDGET_TIERS.indexOf(r.budgetTier) >= 4 && BUDGET_TIERS.indexOf(movie.budgetTier) <= 2) bigOpener = true;
  }
  const pressure = competitionPressure(movie, sizeProxy(movie), rivals);
  const wait = week - earliest;
  return size / (1 + 0.5 * pressure) * (bigOpener ? 0.8 : 1) * (1 - 0.012 * wait);
}

/**
 * At wrap: the studio claims a release week at or after the earliest post-production allows.
 * Tentpoles hunt corridors; small films dodge them. Seeded per film. Sets `movie.releaseWeek`.
 */
export function chooseReleaseWeek(state: GameState, ws: WorkingSet, movie: Movie, earliest: number): number {
  const rng = rngFor(state.worldSeed, movie.id, state.week, 'release-date');
  const scheduled = scheduledFilms(ws, movie.id);
  let best = earliest;
  let bestScore = -Infinity;
  for (let w = earliest; w <= earliest + LOOKAHEAD[movie.budgetTier]; w++) {
    const score = dateScore(movie, w, earliest, scheduled) + rng.variance(0.06);
    if (score > bestScore) { bestScore = score; best = w; }
  }
  return best;
}

/** How a studio sizes a campaign relative to the tier norm. */
export function campaignBand(m: Pick<Movie, 'budget' | 'marketingBudget' | 'budgetTier'>): 'heavy' | 'modest' | 'minimal' {
  const intensity = m.marketingBudget / m.budget / MARKETING_RATIO[m.budgetTier];
  return intensity >= 1.25 ? 'heavy' : intensity <= 0.75 ? 'minimal' : 'modest';
}

/**
 * Studio decisions at wrap: the campaign is re-sized once the film has been seen (a film that tests
 * well gets more; a dud is dumped with less), and the release week is claimed. Then any much smaller
 * film already on that week may be moved out of the way — rarely, with a news line.
 */
export function scheduleRelease(state: GameState, ws: WorkingSet, movie: Movie, earliest: number, bus: EventBus): void {
  const rng = rngFor(state.worldSeed, movie.id, state.week, 'wrap-marketing');
  const q = movie.quality?.q ?? 50;
  const aud = movie.quality?.audienceScore ?? 55;
  if (aud >= 72 && q >= 60) movie.marketingBudget = Math.round(movie.marketingBudget * rng.float(1.05, 1.15));
  else if (q < 40 && aud < 48) movie.marketingBudget = Math.round(movie.marketingBudget * rng.float(0.65, 0.85));
  movie.releaseWeek = chooseReleaseWeek(state, ws, movie, earliest);
  markDirty(ws, 'movies', movie.id);
  bumpSmallerRivals(state, ws, movie, bus);
}

/** Chance a much smaller film on the same week is moved when a big one lands. */
const BUMP_CHANCE = 0.35;

export function bumpSmallerRivals(state: GameState, ws: WorkingSet, big: Movie, bus: EventBus): void {
  if (BUDGET_TIERS.indexOf(big.budgetTier) < 3) return; // only Medium+ films push others around
  const week = big.releaseWeek!;
  for (const r of scheduledFilms(ws, big.id)) {
    if (r.releaseWeek !== week || r.budget * 3 > big.budget || audienceOverlap(r, big) < 0.4) continue;
    const rng = rngFor(state.worldSeed, r.id, state.week, `bump:${big.id}`);
    if (!rng.chance(BUMP_CHANCE)) continue;
    const minWeek = Math.max(state.week + 1, (r.wrapWeek ?? state.week) + minPostWeeks(r));
    const others = scheduledFilms(ws, r.id);
    let best: number | null = null;
    let bestScore = -Infinity;
    for (const w of [week - 2, week - 1, week + 1, week + 2]) {
      if (w < minWeek) continue;
      const score = dateScore(r, w, minWeek, others);
      if (score > bestScore) { bestScore = score; best = w; }
    }
    if (best === null) continue;
    const from = r.releaseWeek;
    r.releaseWeek = best;
    r.dateMoves = (r.dateMoves ?? 0) + 1;
    markDirty(ws, 'movies', r.id);
    const studio = ws.studios.get(r.studioId)?.name ?? 'The studio';
    const playerFilm = r.cast.some((c) => c.personId === state.player.id);
    bus.emit(playerFilm ? 'release' : 'news', `${studio} moves ${r.title} to ${formatDate(best, state.epochYear)}`,
      `${big.title} claimed ${formatDate(from!, state.epochYear)}; ${studio} would rather not open a ${r.genres.join('/')} against a $${(big.budget / 1e6).toFixed(0)}M ${big.genres.join('/')}${playerFilm ? ' — your release date has changed.' : '.'}`);
  }
}

/** Minimum post-production length (mirrors MovieEngine.postProductionWeeks without importing it — no cycle). */
function minPostWeeks(m: Movie): number {
  return [5, 6, 8, 10, 12, 14][BUDGET_TIERS.indexOf(m.budgetTier)];
}

/** Everything opening on a given week (for the calendar view and for competition). */
export function openingOn(ws: WorkingSet, week: number): Movie[] {
  const out: Movie[] = [];
  for (const m of ws.movies.values()) {
    if (m.status === 'post-production' && m.releaseWeek === week) out.push(m);
  }
  return out.sort((a, b) => sizeProxy(b) - sizeProxy(a) || (a.id < b.id ? -1 : 1));
}

export function seededMarketRng(worldSeed: number, week: number): Rng {
  return rngFor(worldSeed, 'market', week, 'noise');
}
