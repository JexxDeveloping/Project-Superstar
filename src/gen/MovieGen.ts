/**
 * MovieGen — turns a studio's greenlight decision into a full project: genres, budget, director,
 * hidden truths, schedule, and the role slate that casting (and the player's audition board) draw from.
 * Entirely seeded; the same inputs produce the same movie.
 */
import {
  BUDGET_TIERS, clamp, type BudgetTier, type Director, type Gender, type Genre, type Id, type Movie, type MovieRating, type MovieType,
  type Role, type RoleType, type Studio, type StudioIdentity,
} from '../core/GameState';
import { rngFor, type Rng } from '../core/RNG';
import { generateCharacterName } from './NameGen';
import { generateTitle } from './TitleGen';

// ---------------------------------------------------------------------------
// Budget tiers
// ---------------------------------------------------------------------------

export function budgetTier(budget: number): BudgetTier {
  if (budget < 1_000_000) return 'Micro Indie';
  if (budget < 10_000_000) return 'Indie';
  if (budget < 40_000_000) return 'Small Studio';
  if (budget < 100_000_000) return 'Medium';
  if (budget < 200_000_000) return 'Large';
  return 'Tentpole';
}

export const TIER_RANGE: Record<BudgetTier, [number, number]> = {
  'Micro Indie': [150_000, 999_000], 'Indie': [1_000_000, 9_900_000], 'Small Studio': [10_000_000, 39_000_000],
  'Medium': [40_000_000, 99_000_000], 'Large': [100_000_000, 199_000_000], 'Tentpole': [200_000_000, 320_000_000],
};

export const MARKETING_RATIO: Record<BudgetTier, number> = {
  'Micro Indie': 0.3, 'Indie': 0.5, 'Small Studio': 0.8, 'Medium': 1.0, 'Large': 1.0, 'Tentpole': 0.9,
};

export const PRODUCTION_WEEKS: Record<BudgetTier, [number, number]> = {
  'Micro Indie': [3, 4], 'Indie': [4, 6], 'Small Studio': [6, 8], 'Medium': [8, 11], 'Large': [10, 14], 'Tentpole': [12, 16],
};

export function tierIndex(tier: BudgetTier): number {
  return BUDGET_TIERS.indexOf(tier);
}

// ---------------------------------------------------------------------------
// Studio profiles: what each kind of studio makes
// ---------------------------------------------------------------------------

interface Weighted<T> { item: T; weight: number }

export const STUDIO_PROFILES: Record<StudioIdentity, { tiers: Weighted<BudgetTier>[]; genres: Weighted<Genre>[] }> = {
  blockbuster: {
    tiers: [{ item: 'Medium', weight: 30 }, { item: 'Large', weight: 45 }, { item: 'Tentpole', weight: 25 }],
    genres: [{ item: 'Action', weight: 30 }, { item: 'Fantasy', weight: 18 }, { item: 'Science Fiction', weight: 18 }, { item: 'Thriller', weight: 12 }, { item: 'Family', weight: 12 }, { item: 'Comedy', weight: 10 }],
  },
  prestige: {
    tiers: [{ item: 'Small Studio', weight: 55 }, { item: 'Medium', weight: 40 }, { item: 'Large', weight: 5 }],
    genres: [{ item: 'Drama', weight: 40 }, { item: 'Historical', weight: 18 }, { item: 'Romance', weight: 12 }, { item: 'Mystery', weight: 10 }, { item: 'Crime', weight: 10 }, { item: 'Musical', weight: 10 }],
  },
  comedy: {
    tiers: [{ item: 'Indie', weight: 25 }, { item: 'Small Studio', weight: 50 }, { item: 'Medium', weight: 25 }],
    genres: [{ item: 'Comedy', weight: 65 }, { item: 'Romance', weight: 20 }, { item: 'Family', weight: 15 }],
  },
  mainstream: {
    tiers: [{ item: 'Small Studio', weight: 40 }, { item: 'Medium', weight: 50 }, { item: 'Large', weight: 10 }],
    genres: [{ item: 'Thriller', weight: 18 }, { item: 'Crime', weight: 14 }, { item: 'Action', weight: 16 }, { item: 'Comedy', weight: 14 }, { item: 'Drama', weight: 14 }, { item: 'Sports', weight: 8 }, { item: 'Horror', weight: 8 }, { item: 'Romance', weight: 8 }],
  },
  indie: {
    tiers: [{ item: 'Micro Indie', weight: 40 }, { item: 'Indie', weight: 60 }],
    genres: [{ item: 'Drama', weight: 32 }, { item: 'Horror', weight: 14 }, { item: 'Mystery', weight: 12 }, { item: 'Romance', weight: 12 }, { item: 'Comedy', weight: 14 }, { item: 'Crime', weight: 10 }, { item: 'Western', weight: 6 }],
  },
  genre: {
    tiers: [{ item: 'Indie', weight: 40 }, { item: 'Small Studio', weight: 55 }, { item: 'Medium', weight: 5 }],
    genres: [{ item: 'Horror', weight: 45 }, { item: 'Thriller', weight: 25 }, { item: 'Science Fiction', weight: 15 }, { item: 'Action', weight: 15 }],
  },
};

/** Secondary genres that pair naturally with a primary. */
const PAIRINGS: Partial<Record<Genre, Genre[]>> = {
  Action: ['Thriller', 'Science Fiction', 'Comedy', 'Crime'], Comedy: ['Romance', 'Family', 'Drama', 'Crime'], Drama: ['Romance', 'Historical', 'Crime', 'Sports', 'Mystery'],
  Romance: ['Comedy', 'Drama'], Horror: ['Thriller', 'Mystery', 'Comedy'], Thriller: ['Crime', 'Mystery', 'Action', 'Horror'], Crime: ['Thriller', 'Drama', 'Mystery'],
  Mystery: ['Thriller', 'Drama', 'Crime'], Fantasy: ['Action', 'Family', 'Romance'], 'Science Fiction': ['Action', 'Thriller', 'Drama'], Historical: ['Drama', 'Romance', 'Action'],
  Musical: ['Romance', 'Drama', 'Comedy'], Sports: ['Drama', 'Comedy'], Family: ['Comedy', 'Fantasy'], Western: ['Drama', 'Action'],
};

/** How mainstream a genre's audience is (0–100). */
export const GENRE_APPEAL: Record<Genre, number> = {
  Action: 66, Comedy: 60, Drama: 44, Romance: 52, Horror: 55, Thriller: 56, Crime: 50, Mystery: 46,
  Fantasy: 64, 'Science Fiction': 60, Historical: 40, Musical: 45, Sports: 50, Family: 62, Western: 36,
};

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

const LEAD_SALARY: Record<BudgetTier, number> = {
  'Micro Indie': 3_000, 'Indie': 15_000, 'Small Studio': 150_000, 'Medium': 1_200_000, 'Large': 4_000_000, 'Tentpole': 8_000_000,
};
const ROLE_SALARY_MULT: Record<RoleType, number> = {
  'Main Protagonist': 1.2, 'Lead': 1, 'Co-Lead': 0.6, 'Supporting': 0.25, 'Minor': 0.08, 'Extra': 0.01,
};

/** Base salary for an unknown actor in this role; casting scales it by star power. */
export function roleSalary(tier: BudgetTier, roleType: RoleType): number {
  const raw = LEAD_SALARY[tier] * ROLE_SALARY_MULT[roleType];
  const step = raw >= 100_000 ? 10_000 : raw >= 10_000 ? 500 : 100;
  return Math.max(step, Math.round(raw / step) * step);
}

const ROLE_SLATES: Record<BudgetTier, RoleType[]> = {
  'Micro Indie': ['Lead', 'Co-Lead', 'Supporting', 'Minor'],
  'Indie': ['Lead', 'Co-Lead', 'Supporting', 'Supporting', 'Minor'],
  'Small Studio': ['Lead', 'Co-Lead', 'Supporting', 'Supporting', 'Minor', 'Minor', 'Minor'],
  'Medium': ['Lead', 'Co-Lead', 'Supporting', 'Supporting', 'Minor', 'Minor', 'Minor'],
  'Large': ['Main Protagonist', 'Co-Lead', 'Supporting', 'Supporting', 'Minor', 'Minor', 'Minor'],
  'Tentpole': ['Main Protagonist', 'Co-Lead', 'Co-Lead', 'Supporting', 'Supporting', 'Minor', 'Minor'],
};

function roleSize(role: RoleType): 'lead' | 'supporting' | 'minor' {
  if (role === 'Lead' || role === 'Main Protagonist' || role === 'Co-Lead') return 'lead';
  if (role === 'Supporting') return 'supporting';
  return 'minor';
}

function generateRoles(rng: Rng, movieId: Id, tier: BudgetTier, genres: Genre[]): Role[] {
  const slate = ROLE_SLATES[tier];
  const usedNames = new Set<string>();
  return slate.map((roleType, i) => {
    const size = roleSize(roleType);
    const genderPref: Gender | 'any' = rng.weighted([
      { item: 'male' as const, weight: size === 'minor' ? 35 : 43 }, { item: 'female' as const, weight: size === 'minor' ? 35 : 43 },
      { item: 'any' as const, weight: size === 'minor' ? 30 : 14 },
    ]);
    const band = rng.weighted([
      { item: [18, 30] as [number, number], weight: genres.includes('Family') || genres.includes('Horror') ? 50 : 38 },
      { item: [26, 45] as [number, number], weight: 40 },
      { item: [40, 65] as [number, number], weight: size === 'lead' ? 18 : 28 },
    ]);
    const spread = size === 'lead' ? 0 : 6;
    let name = generateCharacterName(rng, genderPref, size);
    for (let k = 0; k < 5 && usedNames.has(name); k++) name = generateCharacterName(rng, genderPref, size);
    usedNames.add(name);
    const tierReq = [28, 34, 42, 50, 55, 58][tierIndex(tier)];
    const roleReq = { lead: 8, supporting: 0, minor: -8 }[size];
    return {
      id: `${movieId}:r${i + 1}`,
      characterName: name,
      roleType,
      genderPref,
      ageMin: Math.max(18, band[0] - spread),
      ageMax: band[1] + spread,
      requiredActing: clamp(tierReq + roleReq + rng.int(-4, 4), 20, 90),
      difficulty: clamp(30 + tierIndex(tier) * 8 + (size === 'lead' ? 10 : 0) + rng.int(-8, 8), 15, 95),
      salary: roleSalary(tier, roleType),
    };
  });
}

// ---------------------------------------------------------------------------
// Director choice
// ---------------------------------------------------------------------------

/** Fit of a director for a project: specialty match, prestige/budget match, track record, availability. */
export function directorFit(d: Director, genres: Genre[], tier: BudgetTier): number {
  let fit = 40 + d.overall * 0.4;
  if (genres.some((g) => d.genreSpecialty.includes(g))) fit += 22;
  const t = tierIndex(tier);
  fit += t >= 3 ? (d.boxOfficeRecord - 50) * 0.5 : (d.prestige - 50) * 0.35;
  // Big films want proven hands; tiny films can't afford them.
  if (t >= 4 && d.overall < 60) fit -= 25;
  if (t <= 1 && d.overall > 78) fit -= 20;
  return fit;
}

export function chooseDirector(rng: Rng, genres: Genre[], tier: BudgetTier, directors: Director[]): Director | undefined {
  const free = directors.filter((d) => d.status === 'active' && !d.activeMovieId);
  if (free.length === 0) return undefined;
  const scored = free.map((d) => ({ item: d, weight: Math.max(1, directorFit(d, genres, tier) + rng.variance(12)) ** 2 }));
  return rng.weighted(scored);
}

// ---------------------------------------------------------------------------
// The movie
// ---------------------------------------------------------------------------

export interface MovieGenInput {
  universeId: Id;
  worldSeed: number;
  week: number;
  counter: number;
  studio: Studio;
  director: Director;
  takenTitles: Set<string>;
  /** Force a tier (used when seeding the opening universe). */
  tier?: BudgetTier;
  genres?: Genre[];
  /** Genre popularity right now (slates bend toward what's hot). */
  trends?: Partial<Record<Genre, number>>;
}

// ---------------------------------------------------------------------------
// Marketing — a per-film studio decision, not a fixed ratio
// ---------------------------------------------------------------------------

/** How each kind of studio spends relative to the tier norm. */
const IDENTITY_SPEND: Record<StudioIdentity, number> = { blockbuster: 1.1, prestige: 0.95, comedy: 1.0, mainstream: 1.0, indie: 0.8, genre: 1.0 };

/**
 * The campaign the studio commits to at greenlight: the tier norm, the studio's habits, how
 * commercial the project looks, and a seeded call — heavy / normal / minimal. Re-sized at wrap
 * once the film has been seen (ReleaseCalendarEngine.scheduleRelease).
 */
export function decideMarketing(rng: Rng, studio: Pick<Studio, 'identity'>, tier: BudgetTier, budget: number, commercialPotential: number): number {
  const lean = (commercialPotential - 50) / 100; // −0.4 … +0.46
  const size = rng.weighted([
    { item: 1.35, weight: 20 + lean * 40 },
    { item: 1.0, weight: 55 },
    { item: 0.6, weight: 25 - lean * 40 },
  ]);
  const spend = budget * MARKETING_RATIO[tier] * IDENTITY_SPEND[studio.identity] * size * rng.multiplier(0.1);
  const step = spend >= 10_000_000 ? 500_000 : spend >= 1_000_000 ? 50_000 : 5_000;
  return Math.max(step, Math.round(spend / step) * step);
}

// ---------------------------------------------------------------------------
// Metadata for the movie profile page
// ---------------------------------------------------------------------------

const PLOT_ARCS = ['Rise and fall', 'Redemption', 'The quest', 'Revenge', 'Coming of age', 'Underdog', 'The heist', 'Survival', 'Forbidden love', 'The unravelling', 'Rags to riches', 'Tragedy', 'Fish out of water', 'Second chance'];

const PROTAGONISTS: Partial<Record<Genre, string[]>> = {
  Action: ['a burned-out operative', 'a disgraced soldier', 'a getaway driver', 'a bodyguard with one job left'],
  Comedy: ['a hopeless best man', 'two feuding neighbours', 'a substitute teacher', 'a wedding planner on her last nerve'],
  Drama: ['a widowed schoolteacher', 'an estranged son', 'a nurse on night shift', 'a failing novelist'],
  Romance: ['a florist who has sworn off love', 'two strangers sharing a train compartment', 'a chef and her harshest critic'],
  Horror: ['a family in a new house', 'four students on a road trip', 'a night-shift caretaker', 'a small-town sheriff'],
  Thriller: ['a whistleblower', 'a court stenographer', 'a pilot who saw too much', 'an insurance investigator'],
  Crime: ['a mid-level fixer', 'a detective one week from retirement', 'a bookkeeper for the wrong people'],
  Mystery: ['a retired inspector', 'a true-crime podcaster', 'a lighthouse keeper', 'an archivist'],
  Fantasy: ['an orphaned map-maker', 'the last of the river guardians', 'a thief with a stolen crown'],
  'Science Fiction': ['a cargo pilot on a dying ship', 'a memory technician', 'a colony doctor', 'a decommissioned android'],
  Historical: ['a court painter', 'a field surgeon', 'a queen\'s translator', 'a railway engineer'],
  Musical: ['a church choir director', 'a washed-up crooner', 'three sisters with one microphone'],
  Sports: ['an ageing boxer', 'a small-town relay team', 'a rookie goalkeeper', 'a swimmer banned from the pool'],
  Family: ['a boy and a very large dog', 'a girl who can talk to weather', 'twins who swap schools'],
  Western: ['a bounty hunter', 'a widow defending her land', 'a marshal without a town'],
};
const GOALS: Partial<Record<Genre, string[]>> = {
  Action: ['must pull one last job', 'has 48 hours to clear their name', 'is hunted across three borders'],
  Comedy: ['must survive a week with the in-laws', 'accidentally becomes famous', 'fakes a job to keep a flat'],
  Drama: ['returns home for a funeral that reopens everything', 'takes in a stranger\'s child', 'faces the year that changed the family'],
  Romance: ['makes a bet they can\'t keep', 'falls for the person they were sent to ruin', 'gets one summer to say it'],
  Horror: ['discovers the house remembers', 'wakes something in the woods', 'learns why the town never leaves the lights on'],
  Thriller: ['has proof that someone wants buried', 'must find out who is inside the house', 'is framed for a crash that wasn\'t an accident'],
  Crime: ['is offered a way out that isn\'t one', 'has to move the money before dawn', 'realises the crew has a leak'],
  Mystery: ['reopens the case everyone wanted closed', 'finds a body that shouldn\'t exist', 'follows a letter forty years late'],
  Fantasy: ['must return a stolen crown before the tide turns', 'wakes the old kingdom', 'is chosen for a war that isn\'t theirs'],
  'Science Fiction': ['has one orbit to fix what the crew broke', 'learns the colony has been lying', 'is asked to erase a life'],
  Historical: ['is caught between two courts', 'carries a message across a war', 'records what the powerful want forgotten'],
  Musical: ['has one night to save the theatre', 'writes the song that could end a feud', 'gets a second shot at the big stage'],
  Sports: ['gets one more season', 'takes a team nobody wants to a final nobody expects', 'trains for the race that broke them'],
  Family: ['must find a way home before the fair ends', 'tries to save the town parade', 'discovers the attic goes somewhere'],
  Western: ['rides into a town that wants them dead', 'must hold the line until the railroad comes', 'hunts the man who burned the ranch'],
};

function ratingFor(rng: Rng, genres: Genre[]): MovieRating {
  const g = genres[0];
  if (g === 'Family') return rng.weighted([{ item: 'G' as const, weight: 35 }, { item: 'PG' as const, weight: 65 }]);
  if (g === 'Horror') return rng.weighted([{ item: 'R' as const, weight: 75 }, { item: 'PG-13' as const, weight: 25 }]);
  if (g === 'Crime' || g === 'Drama' || g === 'Thriller' || g === 'Western') return rng.weighted([{ item: 'R' as const, weight: 55 }, { item: 'PG-13' as const, weight: 45 }]);
  if (g === 'Action' || g === 'Science Fiction' || g === 'Fantasy') return rng.weighted([{ item: 'PG-13' as const, weight: 80 }, { item: 'R' as const, weight: 15 }, { item: 'PG' as const, weight: 5 }]);
  return rng.weighted([{ item: 'PG-13' as const, weight: 55 }, { item: 'PG' as const, weight: 25 }, { item: 'R' as const, weight: 20 }]);
}

export function generateMetadata(rng: Rng, genres: Genre[], tier: BudgetTier): { type: MovieType; rating: MovieRating; runtime: number; plotArc: string; plot: string } {
  const g = genres[0];
  const animationChance = g === 'Family' ? 0.35 : g === 'Fantasy' ? 0.12 : 0.02;
  const type: MovieType = rng.chance(animationChance) ? 'animation' : 'live-action';
  const longGenre = g === 'Drama' || g === 'Historical' || g === 'Fantasy' || g === 'Science Fiction';
  const runtime = clamp(Math.round((longGenre ? 118 : g === 'Horror' || g === 'Comedy' || g === 'Family' ? 96 : 106) + tierIndex(tier) * 3 + rng.variance(14)), 78, 175);
  const who = rng.pick(PROTAGONISTS[g] ?? PROTAGONISTS.Drama!);
  const what = rng.pick(GOALS[g] ?? GOALS.Drama!);
  const second = genres[1] ? ` A ${genres[1].toLowerCase()} in ${g.toLowerCase()} clothes.` : '';
  const plot = `${who[0].toUpperCase()}${who.slice(1)} ${what}.${second}`;
  return { type, rating: ratingFor(rng, genres), runtime, plotArc: rng.pick(PLOT_ARCS), plot };
}

/** Studios chase what is in fashion: slate weights bend toward hot genres and away from cold ones. */
export function pickTierAndGenres(rng: Rng, studio: Studio, trends?: Partial<Record<Genre, number>>): { tier: BudgetTier; genres: Genre[] } {
  const profile = STUDIO_PROFILES[studio.identity];
  const tier = rng.weighted(profile.tiers);
  const primary = rng.weighted(trends ? profile.genres.map((w) => ({ item: w.item, weight: w.weight * Math.pow(trends[w.item] ?? 1, 1.5) })) : profile.genres);
  const genres: Genre[] = [primary];
  if (rng.chance(0.45)) {
    const options = (PAIRINGS[primary] ?? []).filter((g) => g !== primary);
    if (options.length) genres.push(rng.pick(options));
  }
  return { tier, genres };
}

export function generateMovie(input: MovieGenInput): Movie {
  const { universeId, worldSeed, week, counter, studio, director } = input;
  const id = `m-${week}-${counter}`;
  const rng = rngFor(worldSeed, id, week, 'moviegen');

  const picked = pickTierAndGenres(rng, studio, input.trends);
  const tier = input.tier ?? picked.tier;
  const genres = input.genres ?? picked.genres;
  const [lo, hi] = TIER_RANGE[tier];
  // Log-uniform inside the tier so cheap films are common and the top of a tier is rare.
  const budgetRaw = Math.exp(rng.float(Math.log(lo), Math.log(hi)));
  const step = budgetRaw >= 10_000_000 ? 1_000_000 : budgetRaw >= 1_000_000 ? 100_000 : 10_000;
  const budget = Math.max(lo, Math.round(budgetRaw / step) * step);

  const title = generateTitle(rng, genres, input.takenTitles);
  const [minW, maxW] = PRODUCTION_WEEKS[tier];

  const scriptQuality = clamp(40 + (studio.reputation - 50) * 0.3 + (director.overall - 50) * 0.35 + rng.variance(16), 12, 96);
  const appeal = clamp(GENRE_APPEAL[genres[0]] * 0.7 + 15 + rng.variance(16), 10, 95);
  const commercialPotential = clamp(0.45 * appeal + 0.25 * (tierIndex(tier) * 14) + 0.15 * director.boxOfficeRecord + 8 + rng.variance(10), 8, 96);

  const castingCloseWeek = week + rng.int(3, 5);
  const productionStartWeek = castingCloseWeek + rng.int(2, 6);
  const meta = generateMetadata(rng, genres, tier);

  return {
    id,
    universeId,
    title,
    genres,
    studioId: studio.id,
    directorId: director.id,
    budget,
    marketingBudget: decideMarketing(rng, studio, tier, budget, commercialPotential),
    budgetTier: tier,
    roles: generateRoles(rng, id, tier, genres),
    cast: [],
    status: 'casting',
    announcedWeek: week,
    castingCloseWeek,
    productionStartWeek,
    productionWeeks: rng.int(minW, maxW),
    ...meta,
    hidden: { scriptQuality, audienceAppeal: appeal, commercialPotential },
    productionQualityMod: 0,
  };
}
