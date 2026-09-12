/**
 * CareerEngine — the arc of a career over decades: aging, peaks, retirement, and the yearly
 * turnover (new actors and directors entering) that keeps the industry populated.
 *
 * Applies to NPCs and directors every week. The player ages here too, but the player's
 * retirement is voluntary (or the age-75 cap from Part 6) and is handled by Game.
 */
import { completedCredits, fullName, type GameState, type WorkingSet, markDirty } from '../core/GameState';
import { rngFor } from '../core/RNG';
import type { EventBus } from '../core/EventBus';
import { WEEKS_PER_YEAR, ageInYears, starTier } from './ActorEngine';
import { cohortEntry } from './NPCEngine';
import { emergeDirectors } from '../world/DirectorEngine';

export const CAREER_AGE_CAP = 75;

/** Weekly retirement probability for an actor, from age and inactivity. */
export function actorRetirementChance(age: number, idleWeeks: number, starPower: number): number {
  let p = 0;
  if (age >= CAREER_AGE_CAP) return 1;
  if (age >= 70) p += 0.008;
  else if (age >= 60) p += 0.002;
  else if (age >= 50) p += 0.0004;
  // Careers that dried up: three idle years and no name to trade on.
  if (idleWeeks > 3 * WEEKS_PER_YEAR && starPower < 30 && age > 32) p += 0.01;
  if (idleWeeks > 6 * WEEKS_PER_YEAR) p += 0.02;
  return p;
}

/** Never-booked hopefuls quit the business after a few fruitless years. */
export function hopefulQuitChance(idleWeeks: number, credits: number): number {
  return credits === 0 && idleWeeks > 4 * WEEKS_PER_YEAR ? 0.02 : 0;
}

export function directorRetirementChance(age: number, idleWeeks: number): number {
  if (age >= 80) return 1;
  let p = 0;
  if (age >= 72) p += 0.006;
  else if (age >= 65) p += 0.0015;
  if (idleWeeks > 5 * WEEKS_PER_YEAR) p += 0.01;
  return p;
}

/** Weekly: retirements for NPC actors and directors; yearly: cohort entry and new directors. */
export function tickCareers(state: GameState, ws: WorkingSet, bus: EventBus): void {
  const { week, worldSeed, universeId } = state;

  for (const p of ws.people.values()) {
    if (p.isPlayer || p.status !== 'active') continue;
    if (p.activeMovieIds.length > 0) continue; // finish the film first
    const age = ageInYears(p, week);
    const chance = actorRetirementChance(age, week - p.lastWorkedWeek, p.attributes.starPower) + hopefulQuitChance(week - p.lastWorkedWeek, completedCredits(p).length);
    if (chance <= 0) continue;
    const rng = rngFor(worldSeed, p.id, week, 'retire');
    if (rng.chance(chance)) {
      p.status = 'retired';
      p.retiredWeek = week;
      markDirty(ws, 'people', p.id);
      if (p.peakStarPower >= 60) {
        bus.emit('industry', `${fullName(p)} retires at ${age}`, `A ${starTier(p.peakStarPower)} at their peak, with ${completedCredits(p).length} film credits.`);
      }
    }
  }

  for (const d of ws.directors.values()) {
    if (d.status !== 'active' || d.activeMovieId) continue;
    const age = ageInYears(d, week);
    const chance = directorRetirementChance(age, week - d.lastWorkedWeek);
    if (chance <= 0) continue;
    const rng = rngFor(worldSeed, d.id, week, 'retire');
    if (rng.chance(chance)) {
      d.status = 'retired';
      markDirty(ws, 'directors', d.id);
      if (d.prestige >= 60 || d.boxOfficeRecord >= 65) {
        bus.emit('industry', `Director ${fullName(d)} retires at ${age}`, `${d.filmIds.length} films; a ${d.prestige >= 60 ? 'prestige' : 'box-office'} career.`);
      }
    }
  }

  // Yearly turnover on the first week of each year.
  if (week % WEEKS_PER_YEAR === 0) {
    const newActors = cohortEntry(universeId, worldSeed, week, state.genCounter, ws, bus);
    state.genCounter += newActors.length;
    const newDirectors = emergeDirectors(universeId, worldSeed, week, state.genCounter, ws, bus);
    state.genCounter += newDirectors.length;
  }
}
