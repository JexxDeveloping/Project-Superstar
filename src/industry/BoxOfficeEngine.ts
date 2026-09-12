/**
 * BoxOfficeEngine — the Commercial axis (C).
 *
 * Phase 1 (v1): opening weekend from demand fundamentals, then a weekly percentage-decline run
 * driven by reception, ending in a Bollywood-style verdict on gross ÷ production budget.
 * Phase 4 replaces the internals with the full release-calendar / competition model; the
 * interface (open → tick → finish → impacts) stays.
 *
 * C feeds *only* the commercial side: star power, fan popularity, momentum, studio trust.
 */
import {
  clamp, type BoxOfficeRun, type BudgetTier, type Director, type Genre, type Movie, type Person,
  type RoleType, type StatDelta, type Studio, type Verdict, type WorkingSet, markDirty,
} from '../core/GameState';
import { rngFor } from '../core/RNG';
import { roleInfluence } from './MovieEngine';

// ---------------------------------------------------------------------------
// Verdict ladder (confirmed in plan): worldwide gross ÷ production budget
// ---------------------------------------------------------------------------

/** Bollywood-style: gross compared to the production budget only (marketing excluded). */
export const VERDICT_BASIS: 'production' | 'production+marketing' = 'production';

export const VERDICT_LADDER: { min: number; verdict: Verdict }[] = [
  { min: 3.0, verdict: 'All-Time Blockbuster' },
  { min: 2.5, verdict: 'Blockbuster' },
  { min: 2.0, verdict: 'Super Hit' },
  { min: 1.5, verdict: 'Hit' },
  { min: 0.75, verdict: 'Average' },
  { min: 0.30, verdict: 'Flop' },
  { min: 0, verdict: 'Disaster' },
];

export function verdictFor(worldwide: number, movie: Pick<Movie, 'budget' | 'marketingBudget'>): Verdict {
  const basis = VERDICT_BASIS === 'production' ? movie.budget : movie.budget + movie.marketingBudget;
  const ratio = worldwide / basis;
  for (const step of VERDICT_LADDER) if (ratio >= step.min) return step.verdict;
  return 'Disaster';
}

export const VERDICT_RANK: Record<Verdict, number> = {
  'Disaster': 0, 'Flop': 1, 'Average': 2, 'Hit': 3, 'Super Hit': 4, 'Blockbuster': 5, 'All-Time Blockbuster': 6,
};

// ---------------------------------------------------------------------------
// Demand tables
// ---------------------------------------------------------------------------

/**
 * Opening-week domestic as a fraction of production budget, by tier, before modifiers.
 * Calibrated so an all-average film lands near 1.3× budget worldwide (an "Average" verdict) in every
 * tier — small films travel poorly, so they must open relatively bigger at home to get there.
 */
const OPENING_RATIO: Record<BudgetTier, number> = {
  'Micro Indie': 0.55, 'Indie': 0.46, 'Small Studio': 0.37, 'Medium': 0.29, 'Large': 0.21, 'Tentpole': 0.18,
};
/** How much cast star power moves the opening; names matter far more on a tentpole than a micro-indie. */
const STAR_WEIGHT: Record<BudgetTier, number> = {
  'Micro Indie': 0.4, 'Indie': 0.6, 'Small Studio': 0.9, 'Medium': 1.1, 'Large': 1.3, 'Tentpole': 1.4,
};
/** Marketing spend the tier normally carries (ratio to budget); over/under-spend moves the opening. */
const MARKETING_NORM: Record<BudgetTier, number> = {
  'Micro Indie': 0.3, 'Indie': 0.5, 'Small Studio': 0.8, 'Medium': 1.0, 'Large': 1.0, 'Tentpole': 0.9,
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
/** Genres that front-load (horror) vs. leg out (family, drama). Added to the week-2 drop. */
const GENRE_DROP: Partial<Record<Genre, number>> = { Horror: 0.08, Action: 0.03, Family: -0.06, Drama: -0.05, Romance: -0.02, Comedy: -0.02 };

const MAX_RUN_WEEKS = 10;
const MIN_RUN_WEEKS = 4;

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

/** Simulate opening weekend and start the run. */
export function openRun(worldSeed: number, week: number, movie: Movie, ws: WorkingSet): BoxOfficeRun {
  const director = ws.directors.get(movie.directorId) as Director;
  const studio = ws.studios.get(movie.studioId) as Studio;
  const rng = rngFor(worldSeed, movie.id, week, 'bo-opening');
  const tier = movie.budgetTier;

  const marketingFactor = clamp(Math.sqrt((movie.marketingBudget / movie.budget) / MARKETING_NORM[tier]), 0.6, 1.4);
  const star = castStarPower(movie, ws);
  const starFactor = 1 + (star / 100 - 0.35) * STAR_WEIGHT[tier];
  const genreFactor = avg(movie.genres.map((g) => GENRE_OPENING[g]));
  const potentialFactor = 0.6 + (movie.hidden.commercialPotential / 100) * 0.8;
  const directorFactor = 0.85 + (director.boxOfficeRecord / 100) * 0.3;
  const studioFactor = 0.9 + (studio.reputation / 100) * 0.2;
  // Pre-release buzz: critics screen early; a strong film gets a modest opening bump, a weak one a small dent.
  const critic = movie.quality?.criticScore ?? 55;
  const buzzFactor = 1 + (critic - 55) / 400;
  // Log-shaped luck: most films land within ±20% of their fundamentals; a few break out or crater.
  const luck = Math.exp(rng.variance(1.5));

  const openingDomestic = Math.round(
    movie.budget * OPENING_RATIO[tier] * marketingFactor * starFactor * genreFactor * potentialFactor * directorFactor * studioFactor * buzzFactor * luck,
  );
  const intlRatio = avg(movie.genres.map((g) => GENRE_INTL[g])) * TIER_INTL[tier] * (0.8 + star / 200) * rng.multiplier(0.2);
  const openingInternational = Math.round(openingDomestic * intlRatio);

  const run: BoxOfficeRun = {
    weeks: [{ week, domestic: openingDomestic, international: openingInternational }],
    openingDomestic,
    openingInternational,
    totalDomestic: openingDomestic,
    totalInternational: openingInternational,
    worldwide: openingDomestic + openingInternational,
    finished: false,
  };
  movie.boxOffice = run;
  return run;
}

/** Simulate one more theatrical week. Returns true when the run finished this week. */
export function tickRun(worldSeed: number, week: number, movie: Movie): boolean {
  const run = movie.boxOffice;
  if (!run || run.finished) return false;
  const rng = rngFor(worldSeed, movie.id, week, 'bo-week');
  const n = run.weeks.length; // number of weeks already played; this is week n+1
  const last = run.weeks[n - 1];
  const audience = movie.quality?.audienceScore ?? 55;
  const critic = movie.quality?.criticScore ?? 55;

  // Percentage decline: base ~47%, moved by word of mouth (audience), reviews, genre, and week.
  let drop = 0.47;
  drop -= ((audience - 60) / 100) * 0.5; // audience 90 → 0.32; audience 40 → 0.57
  drop -= ((critic - 60) / 100) * 0.15;
  drop += movie.genres.reduce((s, g) => s + (GENRE_DROP[g] ?? 0), 0) / movie.genres.length;
  if (n >= 2) drop *= 0.85; // later weeks decay more gently as the audience settles
  drop += rng.variance(0.06);

  // Sleeper: small opening relative to budget + loved by audiences → it can grow.
  const sleeper = n === 1 && audience >= 76 && run.openingDomestic < movie.budget * 0.25;
  if (sleeper) drop = -rng.float(0.05, 0.35);

  drop = clamp(drop, -0.4, 0.8);
  const domestic = Math.round(last.domestic * (1 - drop));
  const international = Math.round(last.international * (1 - clamp(drop - 0.05, -0.4, 0.8)));

  run.weeks.push({ week, domestic, international });
  run.totalDomestic += domestic;
  run.totalInternational += international;
  run.worldwide = run.totalDomestic + run.totalInternational;

  const weekly = domestic + international;
  const openingWW = run.openingDomestic + run.openingInternational;
  const weeksPlayed = run.weeks.length;
  if (weeksPlayed >= MAX_RUN_WEEKS || (weeksPlayed >= MIN_RUN_WEEKS && weekly < openingWW * 0.03)) {
    run.finished = true;
    run.verdict = verdictFor(run.worldwide, movie);
    return true;
  }
  return false;
}

export function weekOverWeek(run: BoxOfficeRun, i: number): number | null {
  if (i === 0) return null;
  const prev = run.weeks[i - 1].domestic;
  return prev > 0 ? (run.weeks[i].domestic - prev) / prev : null;
}

// ---------------------------------------------------------------------------
// Impacts — the commercial side of the player's career, and nothing else
// ---------------------------------------------------------------------------

export function commercialImpacts(movie: Movie, roleType: RoleType, run: BoxOfficeRun, ws: WorkingSet): StatDelta[] {
  const verdict = run.verdict ?? verdictFor(run.worldwide, movie);
  const rank = VERDICT_RANK[verdict];
  const inf = roleInfluence(roleType);
  const weight = 0.4 + 0.6 * inf;
  // Absolute scale: a micro-indie tripling its budget is a great story, not a star-making event.
  const scale = 0.5 + 0.5 * Math.min(1, Math.log10(run.worldwide / 1_000_000 + 1) / 2.3);
  const out: StatDelta[] = [];

  // Exposure: being seen in a release lifts a name a little regardless of verdict; the verdict does the rest.
  const exposure = 1.5 * inf * scale;
  const star = exposure + [-3, -1.5, 0.5, 2, 3.5, 5, 7][rank] * weight * scale;
  out.push({ target: 'starPower', label: 'Star Power', amount: round1(star) });
  const fans = exposure + [-2, -1, 0.5, 2.5, 4, 6, 8][rank] * weight * scale;
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
