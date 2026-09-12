/**
 * MovieGen — turns a studio's greenlight decision into a full project: genres, budget, director,
 * hidden truths, schedule, and the role slate that casting (and the player's audition board) draw from.
 * Entirely seeded; the same inputs produce the same movie.
 */
import {
  BUDGET_TIERS, clamp, type BudgetTier, type Director, type Gender, type Genre, type Id, type Movie,
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
}

export function pickTierAndGenres(rng: Rng, studio: Studio): { tier: BudgetTier; genres: Genre[] } {
  const profile = STUDIO_PROFILES[studio.identity];
  const tier = rng.weighted(profile.tiers);
  const primary = rng.weighted(profile.genres);
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

  const picked = pickTierAndGenres(rng, studio);
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

  return {
    id,
    universeId,
    title,
    genres,
    studioId: studio.id,
    directorId: director.id,
    budget,
    marketingBudget: Math.round(budget * MARKETING_RATIO[tier]),
    budgetTier: tier,
    roles: generateRoles(rng, id, tier, genres),
    cast: [],
    status: 'casting',
    announcedWeek: week,
    castingCloseWeek,
    productionStartWeek,
    productionWeeks: rng.int(minW, maxW),
    hidden: { scriptQuality, audienceAppeal: appeal, commercialPotential },
    productionQualityMod: 0,
  };
}
