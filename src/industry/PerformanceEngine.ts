/**
 * PerformanceEngine — the Performance axis (P, 1–5), for any actor in any film.
 *
 * P = fundamentals + circumstances + bounded variance, with the top tiers threshold-gated:
 * you cannot luck into an All-Time performance without the fundamentals clearing a high bar.
 * P feeds *only* the acting side of a career: critical reputation, director trust, skill XP.
 */
import {
  PERFORMANCE_LABELS, clamp, type Director, type Genre, type Movie, type PerformanceResult,
  type PerformanceScore, type Person, type RoleType, type StatDelta, type WorkingSet,
} from '../core/GameState';
import { rngFor } from '../core/RNG';
import { roleInfluence } from './MovieEngine';

/**
 * Raw = 0.85 × fundamentals + circumstances + variance. The compression means even a 95-acting
 * actor cannot reach the top band on craft alone — the circumstances (prep, director, script,
 * a charmed shoot) have to show up too, and variance only decides the close calls.
 */
const FUNDAMENTALS_WEIGHT = 0.85;
const SCORE_THRESHOLDS: { min: number; score: PerformanceScore }[] = [
  { min: 96, score: 5 }, { min: 76, score: 4 }, { min: 58, score: 3 }, { min: 36, score: 2 }, { min: 0, score: 1 },
];

/** Fundamentals floors for the top tiers (threshold gating). */
const GATE_FOR_5 = { fundamentals: 78, circumstances: 4 };
const GATE_FOR_4 = { fundamentals: 60 };

export function primaryGenre(movie: Movie): Genre {
  return movie.genres[0];
}

export interface PerformanceContext {
  roleType: RoleType;
  /** 0–9 from audition carry-over + "Prepare for role" weeks (player) or professionalism (NPC). */
  prepBonus: number;
  /** Accumulated on-set modifiers on the actor's side. */
  performanceMod: number;
  /** Player only; NPCs are assumed rested. */
  energy?: number;
  stress?: number;
}

export function evaluatePerformance(
  worldSeed: number, week: number, person: Person, movie: Movie, ctx: PerformanceContext, ws: WorkingSet,
): PerformanceResult {
  const director = ws.directors.get(movie.directorId) as Director;
  const genre = primaryGenre(movie);
  const genreSkill = person.genres[genre];
  const notes: string[] = [];

  // Fundamentals: what the actor brings regardless of circumstances.
  const roleFit = clamp(50 + (genreSkill - 40), 0, 100);
  const fundamentals = 0.45 * person.attributes.acting + 0.35 * genreSkill + 0.20 * roleFit;

  // Circumstances.
  let circumstances = 0;
  circumstances += ctx.prepBonus;
  if (ctx.prepBonus >= 6) notes.push('Deep preparation showed in every scene.');

  const dirLift = (director.actorDevelopment - 50) / 10; // -5 .. +5
  circumstances += dirLift;
  if (dirLift >= 2.5) notes.push(`${director.firstName} ${director.lastName} drew a better performance out of you.`);
  if (dirLift <= -1.5) notes.push('The director offered little guidance.');

  const script = (movie.hidden.scriptQuality - 50) / 10; // -5 .. +5
  circumstances += script;
  if (script >= 2.5) notes.push('A strong script gave you something to play.');
  if (script <= -1.5) notes.push('The script fought you the whole way.');

  circumstances += ctx.performanceMod;
  if (ctx.performanceMod >= 4) notes.push('The shoot itself lifted the work.');
  if (ctx.performanceMod <= -4) notes.push('A rough shoot took its toll.');

  const energy = ctx.energy ?? 80;
  const stress = ctx.stress ?? 20;
  const energyPenalty = energy < 40 ? (40 - energy) / 4 : 0;
  const stressPenalty = stress > 60 ? (stress - 60) / 4 : 0;
  circumstances -= energyPenalty + stressPenalty;
  if (energyPenalty + stressPenalty >= 4) notes.push('Exhaustion and stress blunted the performance.');

  const experience = Math.min(10, person.filmography.length) * 0.6;
  circumstances += experience;

  const rng = rngFor(worldSeed, movie.id, week, `performance:${person.id}`);
  const variance = rng.variance(7) * (person.isPlayer ? 1 : 0.7 + person.volatility / 100);

  const raw = clamp(FUNDAMENTALS_WEIGHT * fundamentals + circumstances + variance, 0, 100);
  let score: PerformanceScore = 1;
  for (const t of SCORE_THRESHOLDS) { if (raw >= t.min) { score = t.score; break; } }

  // Threshold gating: the top tiers need the fundamentals, not just a good day.
  if (score === 5 && (fundamentals < GATE_FOR_5.fundamentals || circumstances < GATE_FOR_5.circumstances)) {
    score = 4;
    notes.push('A great night, but not yet the stuff of legend.');
  }
  if (score === 4 && fundamentals < GATE_FOR_4.fundamentals) {
    score = 3;
    notes.push('Everything broke your way; the craft is still catching up.');
  }
  if (variance >= 4.5 && score >= 3) notes.push('Something clicked on set that no one planned.');
  if (variance <= -4.5 && score <= 2) notes.push('Some weeks the camera just does not love you.');

  return { score, label: PERFORMANCE_LABELS[score], raw: Math.round(raw), fundamentals: Math.round(fundamentals), notes };
}

/** NPCs prepare according to their professionalism; the shoot's modifiers are shared. */
export function npcPerformanceContext(person: Person, movie: Movie, roleType: RoleType): PerformanceContext {
  return { roleType, prepBonus: clamp((person.attributes.professionalism - 30) / 10, 0, 7), performanceMod: movie.productionQualityMod * 0.5 };
}

/**
 * Career consequences of P — and nothing else. Applied when the film's run ends.
 * Routed to: critical reputation, director trust, XP, genre/acting experience.
 */
export function performanceImpacts(movie: Movie, roleType: RoleType, ws: WorkingSet, perf: PerformanceResult): StatDelta[] {
  const inf = roleInfluence(roleType);
  const weight = 0.5 + 0.5 * inf;
  const genre = primaryGenre(movie);
  const director = ws.directors.get(movie.directorId) as Director;
  const out: StatDelta[] = [];

  const critRep = [0, -2, 0, 1.5, 3.5, 6][perf.score] * weight;
  if (critRep !== 0) out.push({ target: 'criticalReputation', label: 'Critical Reputation', amount: round1(critRep) });

  const dirTrust = [0, -4, 0, 3, 6, 10][perf.score];
  if (dirTrust !== 0) out.push({ target: `director:${director.id}`, label: `${director.firstName} ${director.lastName} trust`, amount: dirTrust });

  const xp = perf.score * 40 + Math.round(inf * 100);
  out.push({ target: 'xp', label: 'XP', amount: xp });

  const genreGain = round1(1.0 + (perf.score - 1) * 0.6);
  out.push({ target: `genre:${genre}`, label: `${genre} skill`, amount: genreGain });
  out.push({ target: 'acting', label: 'Acting', amount: round1(0.4 + perf.score * 0.3) });

  if (perf.score >= 4) out.push({ target: 'reputation', label: 'Reputation', amount: round1(1 * weight) });
  return out;
}

export function applyPerformanceImpacts(person: Person, ws: WorkingSet, deltas: StatDelta[]): void {
  for (const d of deltas) {
    if (d.target === 'xp') { person.xp += d.amount; person.level = Math.floor(Math.sqrt(Math.max(0, person.xp) / 100)) + 1; continue; }
    if (d.target.startsWith('director:')) {
      // Director trust is a player relationship; NPC/director trust is Phase 5's RelationshipEngine.
      if (!person.isPlayer) continue;
      const dir = ws.directors.get(d.target.slice('director:'.length));
      if (dir) { dir.playerRelationship = clamp(dir.playerRelationship + d.amount, 0, 100); ws.dirty.directors.add(dir.id); }
      continue;
    }
    if (d.target.startsWith('genre:')) {
      const g = d.target.slice('genre:'.length) as Genre;
      person.genres[g] = clamp(person.genres[g] + d.amount, 1, 100);
      continue;
    }
    const key = d.target as keyof Person['attributes'];
    if (key in person.attributes) {
      const cap = key === 'acting' && !person.isPlayer ? person.ceiling : 100;
      person.attributes[key] = clamp(person.attributes[key] + d.amount, 1, cap);
    }
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
