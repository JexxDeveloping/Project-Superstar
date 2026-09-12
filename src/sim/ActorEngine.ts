/**
 * ActorEngine — the player actor: creation, weekly actions, energy/stress, progression bookkeeping.
 *
 * Operates purely on the in-memory state handed to it. Emits what happened via the tick's EventBus.
 */
import {
  GENRES, clamp, type Archetype, type Attributes, type Background, type Gender, type Genre,
  type GenreSkills, type Person, type PlannedAction, type GameState, type Id,
} from '../core/GameState';
import { rngFor } from '../core/RNG';
import type { EventBus } from '../core/EventBus';

// ---------------------------------------------------------------------------
// Tiers & tables
// ---------------------------------------------------------------------------

export const STAR_TIERS: { min: number; label: string }[] = [
  { min: 95, label: 'Industry Icon' },
  { min: 90, label: 'Superstar' },
  { min: 85, label: 'A-List' },
  { min: 80, label: 'B-List' },
  { min: 70, label: 'C-List' },
  { min: 60, label: 'D-List' },
  { min: 50, label: 'Emerging Actor' },
  { min: 40, label: 'Amateur' },
  { min: 0, label: 'Unknown' },
];

export function starTier(starPower: number): string {
  for (const t of STAR_TIERS) if (starPower >= t.min) return t.label;
  return 'Unknown';
}

/** Small starting bonuses/penalties per background (applied to a base of ~35 acting / ~12 star power). */
const BACKGROUND_MODS: Record<Background, Partial<Attributes> & { genres?: Partial<GenreSkills> }> = {
  'Film Student': { acting: 6, starPower: -3, connections: -3, genres: { Drama: 6 } },
  'Theater Actor': { acting: 8, professionalism: 5, starPower: -4, mediaSkill: -3, genres: { Drama: 5, Musical: 6 } },
  'Child Actor': { acting: 4, connections: 6, starPower: 4, workEthic: -4, genres: { Family: 8 } },
  'Model': { starPower: 6, charisma: 6, acting: -5, genres: { Romance: 5 } },
  'Comedian': { charisma: 5, mediaSkill: 4, acting: -2, genres: { Comedy: 12, Drama: -4 } },
  'Social Media Personality': { starPower: 9, fanPopularity: 12, acting: -7, criticalReputation: -6, mediaSkill: 6 },
  'Athlete': { workEthic: 8, starPower: 3, acting: -6, genres: { Action: 10, Sports: 12 } },
  'Complete Unknown': { workEthic: 3 },
};

/** Archetypes: specialists get big in-lane bonuses and out-of-lane penalties; the generalist gets small spread bonuses. */
export const ARCHETYPE_MODS: Record<Archetype, { bonus: Partial<GenreSkills>; penalty: Genre[]; penaltyAmount: number; attrs?: Partial<Attributes> }> = {
  'Jack of All Trades': { bonus: {}, penalty: [], penaltyAmount: 0 },
  'Action Hero': { bonus: { Action: 12, Thriller: 6, 'Science Fiction': 4 }, penalty: ['Drama', 'Romance', 'Musical'], penaltyAmount: 6 },
  'Dramatic Performer': { bonus: { Drama: 12, Historical: 6, Crime: 4 }, penalty: ['Comedy', 'Action', 'Family'], penaltyAmount: 6 },
  'Comedian': { bonus: { Comedy: 12, Family: 5, Romance: 4 }, penalty: ['Drama', 'Horror', 'Thriller'], penaltyAmount: 6 },
  'Romantic Lead': { bonus: { Romance: 12, Drama: 5, Comedy: 4 }, penalty: ['Action', 'Horror', 'Western'], penaltyAmount: 6, attrs: { charisma: 5 } },
  'Method Actor': { bonus: { Drama: 10, Crime: 8, Thriller: 4 }, penalty: ['Comedy', 'Family', 'Musical'], penaltyAmount: 7, attrs: { acting: 4, mediaSkill: -4 } },
  'Character Actor': { bonus: { Drama: 6, Crime: 6, Mystery: 6, Comedy: 4 }, penalty: ['Action'], penaltyAmount: 4, attrs: { acting: 3, starPower: -4 } },
  'Blockbuster Star': { bonus: { Action: 8, Fantasy: 8, 'Science Fiction': 8 }, penalty: ['Drama', 'Historical'], penaltyAmount: 6, attrs: { starPower: 5, charisma: 3, acting: -3 } },
  'Indie Darling': { bonus: { Drama: 8, Mystery: 6, Romance: 4 }, penalty: ['Action', 'Fantasy', 'Family'], penaltyAmount: 6, attrs: { criticalReputation: 6, starPower: -3 } },
};

export interface PlayerSpec {
  firstName: string;
  lastName: string;
  gender: Gender;
  background: Background;
  archetype: Archetype;
}

export const WEEKS_PER_YEAR = 52;
export const PLAYER_START_AGE = 20; // Part 6: fixed

function baseAttributes(): Attributes {
  return {
    acting: 35, starPower: 12, reputation: 30, connections: 10, fanPopularity: 5,
    criticalReputation: 30, professionalism: 45, charisma: 40, workEthic: 45,
    negotiation: 25, mediaSkill: 30,
  };
}

function baseGenres(rngSeedAttr: number): GenreSkills {
  const g = {} as GenreSkills;
  for (const genre of GENRES) g[genre] = rngSeedAttr;
  return g;
}

/** Build the player actor. Deterministic given (universeId, worldSeed, spec). */
export function createPlayer(universeId: Id, worldSeed: number, startWeek: number, spec: PlayerSpec): Person {
  const id = `player-${universeId}-${startWeek}`;
  const rng = rngFor(worldSeed, id, startWeek, 'create-player');

  const attrs = baseAttributes();
  const genres = baseGenres(28);

  // A little individual variation so two "Film Students" aren't clones.
  for (const k of Object.keys(attrs) as (keyof Attributes)[]) attrs[k] += rng.variance(3);
  for (const g of GENRES) genres[g] += rng.variance(4);

  const bg = BACKGROUND_MODS[spec.background];
  for (const [k, v] of Object.entries(bg)) {
    if (k === 'genres') continue;
    attrs[k as keyof Attributes] += v as number;
  }
  if (bg.genres) for (const [g, v] of Object.entries(bg.genres)) genres[g as Genre] += v as number;

  const arch = ARCHETYPE_MODS[spec.archetype];
  if (arch.attrs) for (const [k, v] of Object.entries(arch.attrs)) attrs[k as keyof Attributes] += v as number;
  for (const [g, v] of Object.entries(arch.bonus)) genres[g as Genre] += v as number;
  for (const g of arch.penalty) genres[g] -= arch.penaltyAmount;
  if (spec.archetype === 'Jack of All Trades') {
    // Small bonus to the three strongest genres.
    const top = [...GENRES].sort((a, b) => genres[b] - genres[a]).slice(0, 3);
    for (const g of top) genres[g] += 4;
  }

  for (const k of Object.keys(attrs) as (keyof Attributes)[]) attrs[k] = clamp(attrs[k], 1, 100);
  for (const g of GENRES) genres[g] = clamp(genres[g], 1, 100);

  return {
    id,
    universeId,
    firstName: spec.firstName,
    lastName: spec.lastName,
    gender: spec.gender,
    birthWeek: startWeek - PLAYER_START_AGE * WEEKS_PER_YEAR,
    isPlayer: true,
    status: 'active',
    background: spec.background,
    archetype: spec.archetype,
    attributes: attrs,
    genres,
    energy: 100,
    stress: 10,
    cash: 5000,
    careerEarnings: 0,
    xp: 0,
    level: 1,
    momentum: 0,
    filmography: [],
    ceiling: 100,
    volatility: 0,
    startWeek,
    lastWorkedWeek: startWeek,
    peakStarPower: attrs.starPower,
    activeMovieIds: [],
    backendEarnings: 0,
    headToHead: [],
  };
}

export function ageInYears(p: { birthWeek: number }, week: number): number {
  return Math.floor((week - p.birthWeek) / WEEKS_PER_YEAR);
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

export function addXp(p: Person, amount: number): { leveledUp: boolean; level: number } {
  p.xp += amount;
  const newLevel = levelForXp(p.xp);
  const leveledUp = newLevel > p.level;
  p.level = newLevel;
  return { leveledUp, level: newLevel };
}

/**
 * Diminishing training gain. Classes teach fundamentals: strong below ~50, thin by 70, nothing past
 * TRAINING_CEILING. Beyond that only the work itself (and great directors) moves the number — and
 * Part 1 wants 95–100 to be extremely hard.
 */
export const TRAINING_CEILING = 80;
function trainingGain(current: number, base: number, variance: number): number {
  const room = Math.max(0, 1 - current / TRAINING_CEILING);
  return Math.max(0, (base + variance) * room ** 1.5);
}

// ---------------------------------------------------------------------------
// Costs (Phase 1 balance constants)
// ---------------------------------------------------------------------------

export const ACTION_COSTS = {
  acting_class: { cash: 150, energy: 15, stress: 4 },
  genre_training: { cash: 100, energy: 15, stress: 3 },
  prepare_role: { cash: 0, energy: 15, stress: 2 },
  rest: { cash: 0, energy: -30, stress: -18 },
  apply: { cash: 0, energy: 4, stress: 2 },
  read_script: { cash: 0, energy: 5, stress: 0 },
} as const;

/** Bartending, temping, whatever pays: idle weeks bring in a little so a slow start isn't a debt spiral. */
export const DAY_JOB_INCOME = 200;
export const PREP_ROLE_BONUS = 3;
export const PREP_ROLE_CAP = 9;

/**
 * Resolve the player's week: planned actions (except `apply`, which AuditionEngine owns),
 * natural energy/stress drift, and living expenses.
 */
export function resolvePlayerWeek(state: GameState, bus: EventBus): void {
  const p = state.player;
  const week = state.week;
  let restedThisWeek = false;

  state.weekPlan.forEach((action: PlannedAction, i: number) => {
    const rng = rngFor(state.worldSeed, p.id, week, `action:${i}:${action.type}`);
    switch (action.type) {
      case 'rest': {
        restedThisWeek = true;
        p.energy = clamp(p.energy - ACTION_COSTS.rest.energy, 0, 100);
        p.stress = clamp(p.stress - -ACTION_COSTS.rest.stress, 0, 100);
        bus.emit('training', 'Rested', 'A quiet week. Energy restored, stress eased.');
        break;
      }
      case 'acting_class': {
        const c = ACTION_COSTS.acting_class;
        p.cash -= c.cash;
        p.energy = clamp(p.energy - c.energy, 0, 100);
        p.stress = clamp(p.stress + c.stress, 0, 100);
        const gain = trainingGain(p.attributes.acting, 0.9, rng.variance(0.3)) * (0.7 + p.attributes.workEthic / 150);
        p.attributes.acting = clamp(p.attributes.acting + gain, 1, 100);
        const xp = addXp(p, 10);
        bus.emit('training', 'Acting class', `Acting +${gain.toFixed(1)}${xp.leveledUp ? ` — reached level ${xp.level}!` : ''}`);
        break;
      }
      case 'genre_training': {
        const c = ACTION_COSTS.genre_training;
        p.cash -= c.cash;
        p.energy = clamp(p.energy - c.energy, 0, 100);
        p.stress = clamp(p.stress + c.stress, 0, 100);
        const gain = trainingGain(p.genres[action.genre], 1.2, rng.variance(0.4)) * (0.7 + p.attributes.workEthic / 150);
        p.genres[action.genre] = clamp(p.genres[action.genre] + gain, 1, 100);
        const xp = addXp(p, 8);
        bus.emit('training', `${action.genre} training`, `${action.genre} +${gain.toFixed(1)}${xp.leveledUp ? ` — reached level ${xp.level}!` : ''}`);
        break;
      }
      case 'prepare_role': {
        const c = ACTION_COSTS.prepare_role;
        p.energy = clamp(p.energy - c.energy, 0, 100);
        p.stress = clamp(p.stress + c.stress, 0, 100);
        if (state.activeProduction) {
          const before = state.activeProduction.prepBonus;
          state.activeProduction.prepBonus = Math.min(PREP_ROLE_CAP, before + PREP_ROLE_BONUS);
          bus.emit('production', 'Prepared for role', `Deeper into the character (prep ${state.activeProduction.prepBonus}/${PREP_ROLE_CAP}).`);
        } else {
          const upcoming = state.applications.find((a) => a.status === 'booked');
          if (upcoming) {
            upcoming.prepBonus = Math.min(PREP_ROLE_CAP, (upcoming.prepBonus ?? 0) + PREP_ROLE_BONUS);
            bus.emit('production', 'Prepared for role', `Studied the part ahead of the shoot (prep ${upcoming.prepBonus}/${PREP_ROLE_CAP}).`);
          } else {
            bus.emit('training', 'Prepared for role', 'No role to prepare for — the week was spent on general scene work.');
            addXp(p, 3);
          }
        }
        break;
      }
      case 'read_script': {
        // Owned by AuditionEngine; the energy cost lands here so every action has a cost.
        p.energy = clamp(p.energy - ACTION_COSTS.read_script.energy, 0, 100);
        break;
      }
      case 'apply': {
        // Owned by AuditionEngine; the small energy cost lands here so every action has a cost.
        p.energy = clamp(p.energy - ACTION_COSTS.apply.energy, 0, 100);
        p.stress = clamp(p.stress + ACTION_COSTS.apply.stress, 0, 100);
        break;
      }
    }
  });

  // Natural drift. Filming weeks are draining; ProductionEngine applies its own costs.
  if (!restedThisWeek) {
    const filming = state.activeProduction !== null;
    p.energy = clamp(p.energy + (filming ? -6 : 10), 0, 100);
    p.stress = clamp(p.stress + (filming ? 3 : -5), 0, 100);
  }

  // A name needs work to stay a name: the same slow fade NPCs get, faster when idle for a year+.
  const idleWeeks = week - p.lastWorkedWeek;
  let fade = 0.015;
  if (!state.activeProduction && idleWeeks > 40) fade += 0.05 + Math.min(0.15, (idleWeeks - 40) / 1000);
  p.attributes.starPower = clamp(p.attributes.starPower - fade, 1, 100);
  p.attributes.fanPopularity = clamp(p.attributes.fanPopularity - fade * 0.8, 1, 100);
  if (p.attributes.starPower > p.peakStarPower) p.peakStarPower = p.attributes.starPower;

  // Living expenses, offset by a day job in weeks you're not on a set.
  if (!state.activeProduction) p.cash += DAY_JOB_INCOME;
  p.cash -= state.weeklyExpenses;
  if (p.cash < 0 && p.cash + state.weeklyExpenses >= 0) {
    bus.emit('finance', 'Out of cash', 'Rent came due and the account went into the red. Book work soon.');
  }

  // Burnout warning.
  if (p.stress >= 80 || p.energy <= 15) {
    bus.emit('training', 'Running on fumes', 'Energy is low and stress is high — auditions and performances will suffer until you rest.');
  }
}
