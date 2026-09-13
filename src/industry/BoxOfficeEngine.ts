/**
 * BoxOfficeEngine — the Commercial axis (C). Phase 4: the full model from Part 3's behavioural spec.
 *
 * total = opening × legs, per market (domestic and international run the same equations with
 * different constants and calendars):
 *
 *   opening_dom  = budget × tierBase × marketing × stars × franchise × genrePop × window × genreWindow
 *                  × competition × buzz × luck
 *   retention_n  = base(genre, market) × reception × WOM × competition_n × age_n × discovery
 *   week_n       = week_(n−1) × retention_n × window(week_n) / window(week_(n−1))
 *
 * Opening is awareness; legs are reception. Word of mouth is a hidden per-film stat that evolves
 * weekly and can push retention ABOVE 100% (sleepers grow), or collapse a film 65–80% (toxic).
 * The verdict is recoupment (theatrical take + afterlife over budget + marketing) with the era gate
 * for All-Time Blockbuster. Fame routes off gross; trust routes off verdict.
 *
 * C feeds *only* the commercial side: star power, fan popularity, momentum, studio trust.
 */
import {
  clamp, type BoxOfficeRun, type BoxOfficeTag, type BudgetTier, type Director, type GameState, type Genre, type Movie,
  type Person, type RoleType, type StatDelta, type Studio, type TrackingReport, type Verdict, type WomBand, type WorkingSet, markDirty,
} from '../core/GameState';
import { rngFor } from '../core/RNG';
import { roleInfluence } from './MovieEngine';
import { MARKETING_RATIO } from '../gen/MovieGen';
import { competitionPressure, genreWindowFactor, marketSize, windowName } from '../world/ReleaseCalendarEngine';
import { WEEKS_PER_YEAR } from '../sim/ActorEngine';

// ---------------------------------------------------------------------------
// Verdict — recoupment (Part 3, resolved designer note)
// ---------------------------------------------------------------------------

/** Studio's share of ticket sales, by market. */
export const THEATRICAL_TAKE = { domestic: 0.5, international: 0.4 } as const;
/** Home / streaming / TV as a fraction of worldwide gross: base, audience swing, genre adjustments, clamp. */
export const AFTERLIFE = { base: 0.30, audienceSwing: 0.15, min: 0.10, max: 0.50 } as const;
export const AFTERLIFE_GENRE: Partial<Record<Genre, number>> = { Family: 0.08, Horror: 0.05, Comedy: 0.03, Drama: -0.03, Historical: -0.05, Western: -0.05 };

export const VERDICT_LADDER: { min: number; verdict: Verdict }[] = [
  { min: 3.0, verdict: 'All-Time Blockbuster' },
  { min: 2.0, verdict: 'Blockbuster' },
  { min: 1.5, verdict: 'Super Hit' },
  { min: 1.1, verdict: 'Hit' },
  { min: 0.75, verdict: 'Average' },
  { min: 0.40, verdict: 'Flop' },
  { min: 0, verdict: 'Disaster' },
];

export const VERDICT_RANK: Record<Verdict, number> = {
  'Disaster': 0, 'Flop': 1, 'Average': 2, 'Hit': 3, 'Super Hit': 4, 'Blockbuster': 5, 'All-Time Blockbuster': 6,
};

export function afterlifeRate(movie: Pick<Movie, 'genres'>, audienceScore: number): number {
  const genre = movie.genres.reduce((s, g) => s + (AFTERLIFE_GENRE[g] ?? 0), 0) / movie.genres.length;
  return clamp(AFTERLIFE.base + ((audienceScore - 60) / 30) * AFTERLIFE.audienceSwing + genre, AFTERLIFE.min, AFTERLIFE.max);
}

export interface Recoupment { theatricalTake: number; afterlife: number; recoup: number; profit: number }

export function recoupmentFor(
  gross: Pick<BoxOfficeRun, 'totalDomestic' | 'totalInternational' | 'worldwide'>, movie: Pick<Movie, 'budget' | 'marketingBudget' | 'genres'>, audienceScore: number,
): Recoupment {
  const theatricalTake = gross.totalDomestic * THEATRICAL_TAKE.domestic + gross.totalInternational * THEATRICAL_TAKE.international;
  const afterlife = gross.worldwide * afterlifeRate(movie, audienceScore);
  const cost = movie.budget + movie.marketingBudget;
  return { theatricalTake, afterlife, recoup: (theatricalTake + afterlife) / cost, profit: theatricalTake + afterlife - cost };
}

/**
 * The label for a recoupment ratio. All-Time Blockbuster also needs scale: worldwide gross at or
 * above `gate` (the era's top-10-of-five-years threshold) — without it the film is a Blockbuster.
 */
export function verdictFor(recoup: number, worldwide = Infinity, gate = 0): Verdict {
  for (const step of VERDICT_LADDER) {
    if (recoup < step.min) continue;
    if (step.verdict === 'All-Time Blockbuster' && worldwide < gate) return 'Blockbuster';
    return step.verdict;
  }
  return 'Disaster';
}

/** Years of history the All-Time gate looks back over. */
export const ATB_WINDOW_YEARS = 5;

/**
 * Era-relative magnitude gate: the 10th-biggest worldwide gross among films whose runs ended in the
 * last five years. Cold start (fewer than ten such films): the film must beat every one of them.
 */
export function allTimeGate(ws: WorkingSet, week: number): number {
  const since = week - ATB_WINDOW_YEARS * WEEKS_PER_YEAR;
  const grosses: number[] = [];
  for (const m of ws.movies.values()) {
    if (m.status !== 'completed') continue;
    const run = m.boxOffice;
    if (!run?.finished) continue;
    const ended = run.weeks[run.weeks.length - 1].week;
    if (ended >= since && ended < week) grosses.push(run.worldwide);
  }
  if (grosses.length === 0) return 0;
  grosses.sort((a, b) => b - a);
  return grosses.length >= 10 ? grosses[9] : grosses[0];
}

// ---------------------------------------------------------------------------
// Demand tables
// ---------------------------------------------------------------------------

/**
 * Opening-week domestic as a fraction of production budget, by tier, before modifiers. Calibrated
 * (Phase 4 harness) so the recoupment verdicts spread roughly Disaster 10 / Flop 30 / Average 30 /
 * Hit 15 / Super Hit 8 / Blockbuster 5 / All-Time 2 across the whole industry.
 */
export const TIER_OPENING: Record<BudgetTier, number> = {
  'Micro Indie': 1.02, 'Indie': 0.82, 'Small Studio': 0.66, 'Medium': 0.55, 'Large': 0.39, 'Tentpole': 0.29,
};
/** How much cast star power moves the opening; names matter far more on a tentpole than a micro-indie. */
const STAR_WEIGHT: Record<BudgetTier, number> = {
  'Micro Indie': 0.4, 'Indie': 0.6, 'Small Studio': 0.9, 'Medium': 1.1, 'Large': 1.3, 'Tentpole': 1.4,
};
const GENRE_OPENING: Record<Genre, number> = {
  Action: 1.15, Comedy: 1.0, Drama: 0.8, Romance: 0.9, Horror: 1.1, Thriller: 1.0, Crime: 0.9, Mystery: 0.85,
  Fantasy: 1.15, 'Science Fiction': 1.1, Historical: 0.75, Musical: 0.85, Sports: 0.9, Family: 1.05, Western: 0.7,
};
/** International gross relative to domestic, by genre. */
const GENRE_INTL: Record<Genre, number> = {
  Action: 1.3, Comedy: 0.6, Drama: 0.7, Romance: 0.8, Horror: 1.0, Thriller: 1.0, Crime: 0.8, Mystery: 0.8,
  Fantasy: 1.35, 'Science Fiction': 1.25, Historical: 0.8, Musical: 0.9, Sports: 0.6, Family: 1.1, Western: 0.6,
};
/** Small films travel less. */
const TIER_INTL: Record<BudgetTier, number> = {
  'Micro Indie': 0.3, 'Indie': 0.5, 'Small Studio': 0.8, 'Medium': 0.95, 'Large': 1.0, 'Tentpole': 1.1,
};
/** Domestic week-over-week retention for a neutral film (reception 60/60, average WOM, empty week). Horror front-loads; family legs out. */
const BASE_RETENTION: Record<Genre, number> = {
  Horror: 0.52, Action: 0.58, Thriller: 0.59, 'Science Fiction': 0.59, Crime: 0.60, Mystery: 0.61, Western: 0.61, Fantasy: 0.62,
  Comedy: 0.63, Romance: 0.63, Sports: 0.63, Musical: 0.65, Historical: 0.65, Drama: 0.67, Family: 0.70,
};
const INTL_RETENTION_BONUS = 0.05;

export const MAX_RUN_WEEKS = 16;
export const MIN_RUN_WEEKS = 4;
/** A run ends when a week falls below this share of the film's peak week. */
const END_SHARE_OF_PEAK = 0.02;
/** Chance a film goes viral in week 2 or 3 (doubled when audiences love it). */
const VIRAL_CHANCE = 0.01;

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
}

/** Influence-weighted star power of the cast. */
export function castStarPower(movie: Movie, ws: WorkingSet): number {
  let w = 0;
  let s = 0;
  for (const c of movie.cast) {
    const person = ws.people.get(c.personId);
    if (!person) continue;
    const inf = roleInfluence(c.roleType);
    s += person.attributes.starPower * inf;
    w += inf;
  }
  return w > 0 ? s / w : 20;
}

/** Spend relative to what the tier normally carries (1 = normal). */
export function marketingIntensity(m: Pick<Movie, 'budget' | 'marketingBudget' | 'budgetTier'>): number {
  return m.marketingBudget / m.budget / MARKETING_RATIO[m.budgetTier];
}

/** What a film of this budget opens to with an ordinary campaign and no names — "its size" for discovery. */
export function normalOpening(m: Pick<Movie, 'budget' | 'budgetTier'>): number {
  return m.budget * TIER_OPENING[m.budgetTier];
}

export function womBand(wom: number): WomBand {
  if (wom >= 70) return 'strong';
  if (wom >= 55) return 'building';
  if (wom >= 38) return 'fading';
  return 'toxic';
}

// ---------------------------------------------------------------------------
// Opening
// ---------------------------------------------------------------------------

export interface Opener { movie: Movie; size: number }

/**
 * The opening a film's fundamentals point to — everything but luck. Used for the tracking report,
 * for Beat/Missed expectations, and as the size other openers see when competition is computed.
 */
export function expectedOpening(state: GameState, ws: WorkingSet, movie: Movie, week: number, rivals: Opener[]): number {
  const director = ws.directors.get(movie.directorId) as Director | undefined;
  const studio = ws.studios.get(movie.studioId) as Studio | undefined;
  const tier = movie.budgetTier;
  const marketing = clamp(Math.pow(marketingIntensity(movie), 0.55), 0.55, 1.5);
  const star = castStarPower(movie, ws);
  const stars = 1 + (star / 100 - 0.35) * STAR_WEIGHT[tier];
  const franchise = 1; // Phase 5/6 hook
  const genrePop = avg(movie.genres.map((g) => GENRE_OPENING[g] * (state.genreTrends[g] ?? 1)));
  const window = marketSize('domestic', week) * genreWindowFactor(movie.genres, week);
  const potential = 0.7 + (movie.hidden.commercialPotential / 100) * 0.6;
  const critic = movie.quality?.criticScore ?? 55;
  const buzz = potential * (1 + (critic - 55) / 400) * (0.85 + ((director?.boxOfficeRecord ?? 50) / 100) * 0.3) * (0.9 + ((studio?.reputation ?? 50) / 100) * 0.2);
  const base = normalOpening(movie) * marketing * stars * franchise * genrePop * window * buzz;
  const pressure = competitionPressure(movie, base, rivals);
  const competition = 1 / (1 + 0.3 * pressure) * (1 - 0.02 * Math.min(5, rivals.length));
  return base * competition;
}

/**
 * Simulate opening week and start the run. `rivals` are the other films opening the same week with
 * their expected sizes (so competition never depends on the order films are processed).
 */
export function openRun(state: GameState, ws: WorkingSet, movie: Movie, rivals: Opener[]): BoxOfficeRun {
  const week = state.week;
  const rng = rngFor(state.worldSeed, movie.id, week, 'bo-opening');
  const expected = expectedOpening(state, ws, movie, week, rivals);
  const trailer = rng.multiplier(0.08);
  // Log-shaped luck: most films land within ±35% of their fundamentals; a few break out or crater.
  const luck = Math.exp(rng.variance(0.6));
  const openingDomestic = Math.max(1000, Math.round(expected * trailer * luck));

  const star = castStarPower(movie, ws);
  const intlRatio = avg(movie.genres.map((g) => GENRE_INTL[g])) * TIER_INTL[movie.budgetTier] * (0.8 + star / 200)
    * (marketSize('international', week) / marketSize('domestic', week)) * Math.exp(rng.variance(0.35));
  const openingInternational = Math.round(openingDomestic * intlRatio);

  // Word of mouth starts at what audiences think, minus the hype gap: a heavy campaign promises more.
  const audience = movie.quality?.audienceScore ?? 55;
  const hypeGap = clamp((marketingIntensity(movie) - 1) * 22, -8, 22);
  const wom = clamp(audience - hypeGap + rng.variance(4), 5, 100);

  const run: BoxOfficeRun = {
    weeks: [{ week, domestic: openingDomestic, international: openingInternational, wom: womBand(wom) }],
    openingDomestic,
    openingInternational,
    totalDomestic: openingDomestic,
    totalInternational: openingInternational,
    worldwide: openingDomestic + openingInternational,
    finished: false,
    wom,
    expectedOpening: Math.round(expected),
    peakWeek: 1,
  };
  movie.boxOffice = run;
  return run;
}

// ---------------------------------------------------------------------------
// Legs
// ---------------------------------------------------------------------------

/** Details of one holdover week, for the explanation notes. */
export interface WeekOutcome {
  finished: boolean;
  retentionDomestic: number;
  windowRatio: number;
  pressure: number;
  /** The opener that pressed hardest on this film this week. */
  topRival?: Movie;
  viral: boolean;
  grew: boolean;
}

/**
 * Simulate one more theatrical week. `openers` are the films opening THIS week (with their actual
 * opening domestic as size); a holdover with a new rival for its audience loses screens to it.
 */
export function tickRun(state: GameState, movie: Movie, openers: Opener[]): WeekOutcome {
  const run = movie.boxOffice!;
  const week = state.week;
  const rng = rngFor(state.worldSeed, movie.id, week, 'bo-week');
  const n = run.weeks.length + 1; // this is week n
  const last = run.weeks[run.weeks.length - 1];
  const audience = movie.quality?.audienceScore ?? 55;
  const critic = movie.quality?.criticScore ?? 55;

  // Word of mouth drifts toward true reception at a speed set by how many have seen it.
  const seen = clamp(run.totalDomestic / (normalOpening(movie) * 2.5), 0.15, 1);
  run.wom += (audience - run.wom) * (0.2 + 0.5 * seen);
  let viral = false;
  if ((n === 2 || n === 3) && rng.chance(VIRAL_CHANCE * (audience >= 80 ? 2 : 1))) {
    run.wom = Math.min(100, run.wom + 22);
    viral = true;
  }

  const base = avg(movie.genres.map((g) => BASE_RETENTION[g]));
  const reception = 1 + ((audience - 60) / 100) * 0.35 + ((critic - 60) / 100) * 0.12;
  const womFactor = 1 + ((run.wom - 55) / 45) * 0.3;
  let pressure = 0;
  let topRival: Movie | undefined;
  let topPress = 0;
  for (const o of openers) {
    const p = competitionPressure(movie, last.domestic, [o]);
    pressure += p;
    if (p > topPress) { topPress = p; topRival = o.movie; }
  }
  pressure *= 0.25;
  const competition = 1 / (1 + 0.35 * pressure);
  const age = n <= 4 ? 1 : Math.pow(0.955, n - 4);
  // Once the opening-weekend crowd is gone the audience that is left drops more gently.
  const settle = 1 + 0.15 * clamp((n - 2) / 3, 0, 1);
  // Discovery: strong word of mouth on a film that opened small for its size — the audience hasn't found it yet.
  // This is the term that pushes retention above 100%.
  const smallness = clamp(1 - run.openingDomestic / normalOpening(movie), 0, 0.85);
  const decay = [0, 0, 1, 0.9, 0.7, 0.5, 0.3][n] ?? 0.15;
  const discovery = Math.min(1.9, 1 + (Math.max(0, run.wom - 60) / 40) * smallness * 2.0 * decay);
  const noise = Math.exp(rng.variance(0.10));

  const windowRatio = marketSize('domestic', week) / marketSize('domestic', last.week);
  const windowRatioIntl = marketSize('international', week) / marketSize('international', last.week);
  const retentionDomestic = base * reception * womFactor * competition * age * settle * discovery * noise;
  const retentionIntl = (base + INTL_RETENTION_BONUS) * Math.pow(reception, 0.7) * Math.pow(womFactor, 0.6) * Math.pow(competition, 0.5) * age * settle * Math.pow(discovery, 0.7) * noise;

  const domestic = Math.round(last.domestic * retentionDomestic * windowRatio);
  const international = Math.round(last.international * retentionIntl * windowRatioIntl);

  run.weeks.push({ week, domestic, international, wom: womBand(run.wom) });
  run.totalDomestic += domestic;
  run.totalInternational += international;
  run.worldwide = run.totalDomestic + run.totalInternational;
  const peak = Math.max(...run.weeks.map((w) => w.domestic));
  run.peakWeek = run.weeks.findIndex((w) => w.domestic === peak) + 1;

  const peakWW = Math.max(...run.weeks.map((w) => w.domestic + w.international));
  const weekly = domestic + international;
  const finished = n >= MAX_RUN_WEEKS || (n >= MIN_RUN_WEEKS && weekly < peakWW * END_SHARE_OF_PEAK) || weekly < 1000;
  if (finished) run.finished = true;
  return { finished, retentionDomestic: retentionDomestic * windowRatio, windowRatio, pressure, topRival, viral, grew: domestic > last.domestic };
}

/** Explanation note for a holdover week. */
export function weekNote(out: WeekOutcome, week: number): BoxOfficeRun['weeks'][number]['note'] {
  const r = out.retentionDomestic;
  if (out.viral) return { kind: 'viral' };
  if (out.windowRatio >= 1.12 && r >= 0.8) return { kind: 'holiday', window: windowName(week) };
  if (out.grew) return { kind: 'grew' };
  if (out.pressure >= 0.5 && out.topRival) return { kind: 'crushed', rivalId: out.topRival.id };
  if (r <= 0.38) return { kind: 'collapsed' };
  if (r >= 0.68) return { kind: 'held' };
  return { kind: 'dropped' };
}

/** The run is over: recoupment, verdict (with the era gate), tags. */
export function finishRun(ws: WorkingSet, movie: Movie, week: number, gate = allTimeGate(ws, week)): void {
  const run = movie.boxOffice!;
  const audience = movie.quality?.audienceScore ?? 55;
  const r = recoupmentFor(run, movie, audience);
  run.theatricalTake = Math.round(r.theatricalTake);
  run.afterlife = Math.round(r.afterlife);
  run.recoup = Math.round(r.recoup * 1000) / 1000;
  run.profit = Math.round(r.profit);
  run.verdict = verdictFor(r.recoup, run.worldwide, gate);
  const tags: BoxOfficeTag[] = [];
  if (run.peakWeek > 1 && run.weeks.some((w) => w.note?.kind === 'grew' || w.note?.kind === 'viral')) tags.push('Sleeper');
  if ((movie.quality?.q ?? 0) >= 68 && (run.verdict === 'Disaster' || run.verdict === 'Flop')) tags.push('Cult seed');
  if (run.openingDomestic >= run.expectedOpening * 1.3) tags.push('Beat expectations');
  else if (run.openingDomestic <= run.expectedOpening * 0.7) tags.push('Missed expectations');
  if (run.weeks.some((w) => w.note?.kind === 'viral')) tags.push('Viral');
  run.tags = tags;
  markDirty(ws, 'movies', movie.id);
}

export function weekOverWeek(run: BoxOfficeRun, i: number): number | null {
  if (i === 0) return null;
  const prev = run.weeks[i - 1].domestic;
  return prev > 0 ? (run.weeks[i].domestic - prev) / prev : null;
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

/**
 * The week before release: "tracking suggests $18–26M". The band sits around the fundamentals with a
 * seeded bias; its width narrows with the player's connections and agent.
 */
export function trackingReport(state: GameState, ws: WorkingSet, movie: Movie, accuracy: number): TrackingReport {
  const week = movie.releaseWeek!;
  const rivals: Opener[] = [];
  for (const m of ws.movies.values()) {
    if (m.id === movie.id || m.status !== 'post-production' || m.releaseWeek !== week) continue;
    rivals.push({ movie: m, size: expectedOpening(state, ws, m, week, []) });
  }
  const expected = expectedOpening(state, ws, movie, week, rivals);
  const rng = rngFor(state.worldSeed, movie.id, week, 'tracking');
  const bias = rng.multiplier(0.12);
  const width = clamp(0.38 - 0.22 * clamp(accuracy, 0, 1), 0.12, 0.4);
  const centre = expected * bias;
  return { week: state.week, low: roundTracking(centre * (1 - width)), high: roundTracking(centre * (1 + width)) };
}

function roundTracking(n: number): number {
  const step = n >= 10_000_000 ? 1_000_000 : n >= 1_000_000 ? 100_000 : n >= 100_000 ? 10_000 : 1_000;
  return Math.max(step, Math.round(n / step) * step);
}

// ---------------------------------------------------------------------------
// Impacts — the commercial side of the player's career, and nothing else.
// Fame (star power, fans) follows GROSS; trust (momentum, studio) follows the VERDICT.
// ---------------------------------------------------------------------------

/** 0 for nothing … ~1 for a billion-dollar gross. Log-shaped: $1M → 0.10, $10M → 0.35, $100M → 0.67. */
export function fameScale(worldwide: number): number {
  return clamp(Math.log10(worldwide / 1_000_000 + 1) / 3, 0, 1.15);
}

export function commercialImpacts(movie: Movie, roleType: RoleType, run: BoxOfficeRun, ws: WorkingSet): StatDelta[] {
  const verdict = run.verdict ?? 'Average';
  const rank = VERDICT_RANK[verdict];
  const inf = roleInfluence(roleType);
  const weight = 0.4 + 0.6 * inf;
  const fame = fameScale(run.worldwide);
  const out: StatDelta[] = [];

  // Exposure: being seen in a release lifts a name a little regardless of gross; the gross does the rest.
  const exposure = 1.8 * inf;
  let star = exposure + (fame - 0.22) * 7 * weight;
  // Late-arriving fame: a film people kept telling each other to see.
  if (run.wom >= 75) star += 0.8 * inf;
  out.push({ target: 'starPower', label: 'Star Power', amount: round1(star) });
  const fans = exposure + (fame - 0.22) * 8 * weight;
  out.push({ target: 'fanPopularity', label: 'Fan Popularity', amount: round1(fans) });
  const momentum = [-15, -8, 2, 10, 16, 22, 30][rank] * (0.5 + 0.5 * inf);
  out.push({ target: 'momentum', label: 'Momentum', amount: Math.round(momentum) });
  const studio = ws.studios.get(movie.studioId);
  if (studio) {
    const trust = [-6, -3, 1, 4, 6, 8, 10][rank] * (0.5 + 0.5 * inf);
    out.push({ target: `studio:${studio.id}`, label: `${studio.name} trust`, amount: round1(trust) });
  }
  return out;
}

export function applyCommercialImpacts(player: Person, ws: WorkingSet, deltas: StatDelta[]): void {
  // Studio trust is a player relationship; NPC/studio trust is Phase 5's RelationshipEngine.
  for (const d of deltas) {
    if (d.target === 'momentum') { player.momentum = clamp(player.momentum + d.amount, -100, 100); continue; }
    if (d.target.startsWith('studio:')) {
      if (!player.isPlayer) continue;
      const s = ws.studios.get(d.target.slice('studio:'.length));
      if (s) { s.playerRelationship = clamp(s.playerRelationship + d.amount, 0, 100); markDirty(ws, 'studios', s.id); }
      continue;
    }
    const key = d.target as keyof Person['attributes'];
    if (key in player.attributes) {
      // Fame has diminishing headroom: the same hit moves an unknown far more than a superstar.
      const room = d.amount > 0 && (key === 'starPower' || key === 'fanPopularity') ? Math.max(0.1, 1 - player.attributes[key] / 115) : 1;
      player.attributes[key] = clamp(player.attributes[key] + d.amount * room, 1, 100);
    }
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatRecoup(r: number): string {
  return `${r.toFixed(2)}×`;
}
