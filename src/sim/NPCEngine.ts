/**
 * NPCEngine — every non-player actor runs a cheaper version of the player's career engine.
 *
 * Generation (seeded, tiered), weekly drift (craft grows with work and youth, star power decays
 * when idle, momentum settles), hidden trajectories (ceiling caps growth; volatility adds swing),
 * and the annual cohort of newcomers. Casting/production/box office happen to NPCs through the
 * same industry engines the player goes through — this file only owns what is NPC-specific.
 */
import {
  GENRES, clamp, fullName, type Archetype, type Attributes, type Gender, type GenreSkills, type Id, type Person,
  type WorkingSet, markDirty,
} from '../core/GameState';
import { rngFor, type Rng } from '../core/RNG';
import type { EventBus } from '../core/EventBus';
import { ARCHETYPE_MODS, WEEKS_PER_YEAR, ageInYears, starTier } from './ActorEngine';
import { generatePersonName } from '../gen/NameGen';

export type NpcTier = 'unknown' | 'working' | 'recognizable' | 'star' | 'superstar';

interface TierSpec { acting: [number, number]; star: [number, number]; age: [number, number]; ceilingBonus: number }
const TIERS: Record<NpcTier, TierSpec> = {
  unknown: { acting: [24, 40], star: [3, 15], age: [18, 26], ceilingBonus: 0 },
  working: { acting: [38, 55], star: [15, 35], age: [22, 36], ceilingBonus: 4 },
  recognizable: { acting: [50, 68], star: [35, 60], age: [26, 45], ceilingBonus: 8 },
  star: { acting: [60, 80], star: [60, 82], age: [30, 52], ceilingBonus: 12 },
  superstar: { acting: [65, 90], star: [84, 95], age: [32, 58], ceilingBonus: 16 },
};

const ARCHETYPES: Archetype[] = ['Jack of All Trades', 'Action Hero', 'Dramatic Performer', 'Comedian', 'Romantic Lead', 'Method Actor', 'Character Actor', 'Blockbuster Star', 'Indie Darling'];

export interface ActorOverrides {
  firstName?: string;
  lastName?: string;
  gender?: Gender;
  ageYears?: number;
  acting?: number;
  starPower?: number;
  charisma?: number;
  genres?: Partial<GenreSkills>;
  archetype?: Archetype;
  ceiling?: number;
  volatility?: number;
}

/** Build an NPC actor. Deterministic for (worldSeed, id). */
export function generateActor(
  universeId: Id, worldSeed: number, week: number, id: Id, tier: NpcTier, takenNames: Set<string>, overrides: ActorOverrides = {},
): Person {
  const rng = rngFor(worldSeed, id, week, 'actorgen');
  const spec = TIERS[tier];
  const gender = overrides.gender ?? rng.weighted([{ item: 'male' as const, weight: 47 }, { item: 'female' as const, weight: 47 }, { item: 'nonbinary' as const, weight: 6 }]);
  const name = overrides.firstName && overrides.lastName
    ? { firstName: overrides.firstName, lastName: overrides.lastName }
    : generatePersonName(rng, gender, takenNames);
  if (overrides.firstName && overrides.lastName) takenNames.add(`${overrides.firstName} ${overrides.lastName}`);
  const ageYears = overrides.ageYears ?? rng.int(spec.age[0], spec.age[1]);
  const archetype = overrides.archetype ?? rng.pick(ARCHETYPES);

  const acting = overrides.acting ?? rng.float(spec.acting[0], spec.acting[1]);
  const star = overrides.starPower ?? rng.float(spec.star[0], spec.star[1]);
  const attributes: Attributes = {
    acting,
    starPower: star,
    reputation: clamp(40 + (star - 30) * 0.3 + rng.variance(12), 5, 95),
    connections: clamp(10 + star * 0.6 + rng.variance(10), 1, 95),
    fanPopularity: clamp(star * 0.9 + rng.variance(10), 1, 100),
    criticalReputation: clamp(30 + (acting - 40) * 0.6 + rng.variance(10), 5, 95),
    professionalism: clamp(50 + rng.variance(20), 10, 95),
    charisma: overrides.charisma ?? clamp(45 + (star - 30) * 0.25 + rng.variance(15), 10, 95),
    workEthic: clamp(50 + rng.variance(20), 10, 95),
    negotiation: clamp(25 + star * 0.4 + rng.variance(12), 5, 95),
    mediaSkill: clamp(30 + star * 0.4 + rng.variance(12), 5, 95),
  };

  // Genre skills: a base tied to craft, shaped by archetype, plus noise.
  const genres = {} as GenreSkills;
  const base = acting * 0.8;
  for (const g of GENRES) genres[g] = clamp(base + rng.variance(8), 1, 100);
  const arch = ARCHETYPE_MODS[archetype];
  for (const [g, v] of Object.entries(arch.bonus)) genres[g as keyof GenreSkills] = clamp(genres[g as keyof GenreSkills] + (v as number), 1, 100);
  for (const g of arch.penalty) genres[g] = clamp(genres[g] - arch.penaltyAmount, 1, 100);
  if (overrides.genres) for (const [g, v] of Object.entries(overrides.genres)) genres[g as keyof GenreSkills] = v as number;

  const ceiling = overrides.ceiling ?? clamp(Math.max(acting + 8, rng.float(45, 92) + spec.ceilingBonus), 30, 100);
  const volatility = overrides.volatility ?? rng.int(15, 70);

  return {
    id, universeId, firstName: name.firstName, lastName: name.lastName, gender,
    birthWeek: week - ageYears * WEEKS_PER_YEAR - rng.int(0, WEEKS_PER_YEAR - 1),
    isPlayer: false, status: 'active',
    background: 'Complete Unknown', archetype,
    attributes, genres,
    energy: 90, stress: 15, cash: Math.round(star * 5_000), careerEarnings: 0, xp: 0, level: 1, momentum: 0,
    filmography: [], ceiling, volatility,
    // Newcomers start their career the week they enter; established talent has been around a while.
    startWeek: tier === 'unknown' ? week : week - Math.max(0, ageYears - 20) * WEEKS_PER_YEAR,
    lastWorkedWeek: tier === 'unknown' ? week - WEEKS_PER_YEAR : week - rng.int(4, 40),
    peakStarPower: star,
    activeMovieIds: [],
    backendEarnings: 0,
    headToHead: [],
    cumulativeGross: 0,
    reviewCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Weekly drift
// ---------------------------------------------------------------------------

function youthFactor(age: number): number {
  if (age < 30) return 1.2;
  if (age < 45) return 0.8;
  if (age < 60) return 0.4;
  return 0.1;
}

/**
 * Per-NPC weekly drift. Craft grows while working (faster when young, capped by the hidden ceiling),
 * star power fades when idle, momentum settles, and volatility adds a small random walk.
 */
export function npcWeeklyDrift(worldSeed: number, week: number, ws: WorkingSet): void {
  for (const p of ws.people.values()) {
    if (p.isPlayer || p.status !== 'active') continue;
    const rng = rngFor(worldSeed, p.id, week, 'drift');
    const age = ageInYears(p, week);
    const working = p.activeMovieIds.length > 0;
    const a = p.attributes;

    // Craft.
    const room = Math.max(0, (p.ceiling - a.acting) / p.ceiling);
    let gain = (working ? 0.16 : 0.03) * youthFactor(age) * room;
    if (age >= 62) gain -= 0.02;
    a.acting = clamp(a.acting + gain, 1, 100);
    if (working) {
      // The genres of the films they're on improve a touch.
      for (const mid of p.activeMovieIds) {
        const m = ws.movies.get(mid);
        if (m) for (const g of m.genres) p.genres[g] = clamp(p.genres[g] + 0.08 * room, 1, 100);
      }
    }

    // Star power: a name needs hits to stay a name — slow baseline fade, faster when idle.
    a.starPower = clamp(a.starPower - 0.015, 1, 100);
    const idleWeeks = week - p.lastWorkedWeek;
    if (!working && idleWeeks > 40) {
      const fade = 0.05 + Math.min(0.15, (idleWeeks - 40) / 1000);
      a.starPower = clamp(a.starPower - fade, 1, 100);
      a.fanPopularity = clamp(a.fanPopularity - fade * 0.8, 1, 100);
    }
    // Volatility: a small random walk in perception.
    a.starPower = clamp(a.starPower + rng.variance(0.12 * p.volatility / 50), 1, 100);
    // Star power is bounded by the hidden ceiling (talent + charisma decides how far a name can travel).
    const starCap = Math.min(100, p.ceiling + 12);
    if (a.starPower > starCap) a.starPower = starCap;

    p.momentum *= 0.98;
    if (a.starPower > p.peakStarPower) p.peakStarPower = a.starPower;
    markDirty(ws, 'people', p.id);
  }
}

// ---------------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------------

export function takenNames(ws: WorkingSet): Set<string> {
  const s = new Set<string>();
  for (const p of ws.people.values()) s.add(fullName(p));
  for (const d of ws.directors.values()) s.add(fullName(d));
  return s;
}

/** A yearly wave of newcomers: mostly unknowns, a few high-ceiling prospects. Returns the new people. */
export function cohortEntry(universeId: Id, worldSeed: number, week: number, counterStart: number, ws: WorkingSet, bus: EventBus): Person[] {
  const rng = rngFor(worldSeed, 'cohort', week, 'size');
  const n = rng.int(12, 20);
  const names = takenNames(ws);
  const out: Person[] = [];
  for (let i = 0; i < n; i++) {
    const id = `p-${week}-${counterStart + i}`;
    const prospect = rng.chance(0.15);
    const person = generateActor(universeId, worldSeed, week, id, 'unknown', names, prospect ? { ceiling: rng.float(80, 96) } : {});
    ws.people.set(id, person);
    markDirty(ws, 'people', id);
    out.push(person);
  }
  bus.emit('industry', `A new class of ${n} actors enters the industry`, 'Fresh faces are hitting the audition circuit this year.');
  return out;
}

export function describeNpc(p: Person, week: number): string {
  return `${fullName(p)} (${ageInYears(p, week)}, ${starTier(p.attributes.starPower)})`;
}

/** Rng helper re-export for callers that seed on an NPC. */
export function npcRng(worldSeed: number, p: Person, week: number, eventId: string): Rng {
  return rngFor(worldSeed, p.id, week, eventId);
}
