/**
 * DirectorEngine — directors as careers: generated in tiers, attached to films, and re-rated by
 * results (prestige follows critics, box-office record follows verdicts, overall drifts slowly).
 */
import {
  GENRES, clamp, fullName, type Director, type Genre, type Id, type Movie, type WorkingSet, markDirty,
} from '../core/GameState';
import { rngFor } from '../core/RNG';
import type { EventBus } from '../core/EventBus';
import { WEEKS_PER_YEAR } from '../sim/ActorEngine';
import { generatePersonName } from '../gen/NameGen';
import { takenNames } from '../sim/NPCEngine';
import { VERDICT_RANK } from '../industry/BoxOfficeEngine';

export type DirectorTier = 'new' | 'working' | 'established' | 'elite';

interface TierSpec { overall: [number, number]; prestige: [number, number]; boxOffice: [number, number]; age: [number, number] }
const TIERS: Record<DirectorTier, TierSpec> = {
  new: { overall: [40, 55], prestige: [25, 45], boxOffice: [30, 50], age: [26, 36] },
  working: { overall: [50, 66], prestige: [35, 60], boxOffice: [40, 65], age: [32, 50] },
  established: { overall: [62, 78], prestige: [50, 78], boxOffice: [50, 78], age: [38, 60] },
  elite: { overall: [76, 92], prestige: [70, 95], boxOffice: [55, 90], age: [42, 66] },
};

export interface DirectorOverrides {
  firstName?: string; lastName?: string; ageYears?: number; overall?: number; prestige?: number;
  specialty?: Genre[]; actorDevelopment?: number; boxOfficeRecord?: number;
}

export function generateDirector(
  universeId: Id, worldSeed: number, week: number, id: Id, tier: DirectorTier, names: Set<string>, overrides: DirectorOverrides = {},
): Director {
  const rng = rngFor(worldSeed, id, week, 'directorgen');
  const spec = TIERS[tier];
  const gender = rng.weighted([{ item: 'male' as const, weight: 55 }, { item: 'female' as const, weight: 40 }, { item: 'nonbinary' as const, weight: 5 }]);
  const name = overrides.firstName && overrides.lastName ? { firstName: overrides.firstName, lastName: overrides.lastName } : generatePersonName(rng, gender, names);
  if (overrides.firstName && overrides.lastName) names.add(`${overrides.firstName} ${overrides.lastName}`);
  const ageYears = overrides.ageYears ?? rng.int(spec.age[0], spec.age[1]);
  const specialty = overrides.specialty ?? (() => {
    const first = rng.pick(GENRES);
    const second = rng.pick(GENRES.filter((g) => g !== first));
    return rng.chance(0.6) ? [first, second] : [first];
  })();
  return {
    id, universeId, firstName: name.firstName, lastName: name.lastName,
    birthWeek: week - ageYears * WEEKS_PER_YEAR - rng.int(0, WEEKS_PER_YEAR - 1),
    status: 'active',
    overall: overrides.overall ?? rng.float(spec.overall[0], spec.overall[1]),
    prestige: overrides.prestige ?? rng.float(spec.prestige[0], spec.prestige[1]),
    genreSpecialty: specialty,
    actorDevelopment: overrides.actorDevelopment ?? clamp(45 + rng.variance(25), 15, 95),
    boxOfficeRecord: overrides.boxOfficeRecord ?? rng.float(spec.boxOffice[0], spec.boxOffice[1]),
    playerRelationship: 50,
    filmIds: [],
    credits: [],
    lastWorkedWeek: week - rng.int(10, 80),
  };
}

/** After a film's run resolves: the director's record moves toward what the film did. */
export function recordDirectorResult(ws: WorkingSet, movie: Movie): void {
  const d = ws.directors.get(movie.directorId);
  if (!d || !movie.quality || !movie.boxOffice?.verdict) return;
  const run = movie.boxOffice;
  if (!d.credits) d.credits = [];
  if (!d.credits.some((c) => c.movieId === movie.id)) {
    d.credits.push({ movieId: movie.id, week: run.weeks[run.weeks.length - 1].week, verdict: movie.boxOffice.verdict, worldwide: run.worldwide, criticScore: movie.quality.criticScore, recoup: run.recoup ?? 0 });
  }
  const rank = VERDICT_RANK[movie.boxOffice.verdict]; // 0..6
  const boTarget = 26 + rank * 12; // Disaster 26 … Average 50 … All-Time 98
  d.boxOfficeRecord = clamp(d.boxOfficeRecord * 0.75 + boTarget * 0.25, 1, 100);
  d.prestige = clamp(d.prestige * 0.8 + movie.quality.criticScore * 0.2, 1, 100);
  // Craft drifts a little toward the quality of the work; great scripts flatter, bad shoots teach.
  d.overall = clamp(d.overall * 0.95 + movie.quality.q * 0.05, 1, 100);
  markDirty(ws, 'directors', d.id);
}

/** A couple of new directors per year, usually unknowns; occasionally a hot arrival from elsewhere. */
export function emergeDirectors(universeId: Id, worldSeed: number, week: number, counterStart: number, ws: WorkingSet, bus: EventBus): Director[] {
  const rng = rngFor(worldSeed, 'directors', week, 'emerge');
  const n = rng.int(2, 4);
  const names = takenNames(ws);
  const out: Director[] = [];
  for (let i = 0; i < n; i++) {
    const id = `d-${week}-${counterStart + i}`;
    const tier: DirectorTier = rng.chance(0.2) ? 'working' : 'new';
    const d = generateDirector(universeId, worldSeed, week, id, tier, names);
    ws.directors.set(id, d);
    markDirty(ws, 'directors', id);
    out.push(d);
    if (tier === 'working') bus.emit('industry', `Director ${fullName(d)} signs with the studios`, `A ${d.genreSpecialty.join('/')} filmmaker arrives with a reputation.`);
  }
  return out;
}
