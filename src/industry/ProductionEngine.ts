/**
 * ProductionEngine — "Week 4 of 11": the player's multi-week shoot.
 *
 * Each filming week can throw a seeded event that nudges the player's performance (P side),
 * the film itself (Q side, shared with the whole cast via the movie), or the player's
 * energy/stress. The two modifier pools are kept separate so the three-axis independence
 * survives the shoot. NPC-only shoots don't run this; they wrap on schedule in MovieEngine.
 */
import {
  clamp, type Application, type GameState, type Movie, type Production, type ProductionEvent, type Role,
  type WorkingSet, markDirty,
} from '../core/GameState';
import { rngFor } from '../core/RNG';
import type { EventBus } from '../core/EventBus';
import { addXp } from '../sim/ActorEngine';

interface EventTemplate {
  title: string;
  description: string;
  weight: number;
  performanceMod: number;
  qualityMod: number;
  energyMod: number;
  stressMod: number;
  /** Optional gate on the player's state. */
  requires?: (state: GameState) => boolean;
  /** Extra side effect (relationships, star power). */
  apply?: (state: GameState, ws: WorkingSet, movie: Movie) => void;
}

const EVENTS: EventTemplate[] = [
  { title: 'Great Scene', description: 'A scene came together beautifully — the crew applauded after the take.', weight: 12, performanceMod: 3, qualityMod: 1, energyMod: 0, stressMod: -3 },
  { title: 'Bad Take', description: 'A key scene dragged through fourteen takes. Not your day.', weight: 10, performanceMod: -2, qualityMod: 0, energyMod: -4, stressMod: 5 },
  { title: 'Director Conflict', description: 'You and the director disagree about the character. It got tense.', weight: 6, performanceMod: -3, qualityMod: -1, energyMod: 0, stressMod: 8,
    apply: (_s, ws, movie) => { const d = ws.directors.get(movie.directorId); if (d) { d.playerRelationship = clamp(d.playerRelationship - 3, 0, 100); markDirty(ws, 'directors', d.id); } } },
  { title: 'Cast Chemistry', description: 'The ensemble is clicking; scenes feel alive.', weight: 9, performanceMod: 2, qualityMod: 2, energyMod: 0, stressMod: -4 },
  { title: 'Script Rewrite', description: 'Pages arrived overnight. Some scenes are sharper, some are chaos.', weight: 7, performanceMod: 0, qualityMod: 0, energyMod: -3, stressMod: 4,
    apply: (state, ws, movie) => {
      const rng = rngFor(state.worldSeed, movie.id, state.week, 'rewrite');
      const delta = rng.chance(0.55) ? 3 : -3;
      if (state.activeProduction) state.activeProduction.qualityMod += delta;
      movie.productionQualityMod += delta;
      markDirty(ws, 'movies', movie.id);
    } },
  { title: 'Improvised Scene', description: 'You went off-script and the director kept it.', weight: 7, performanceMod: 2, qualityMod: 1, energyMod: 0, stressMod: -2,
    requires: (s) => s.player.attributes.charisma >= 40 },
  { title: 'Injury', description: 'A stunt went wrong. You are shooting through the pain.', weight: 4, performanceMod: -2, qualityMod: 0, energyMod: -25, stressMod: 10 },
  { title: 'Production Delay', description: 'Weather and permits pushed the schedule by a week.', weight: 6, performanceMod: 0, qualityMod: 0, energyMod: 0, stressMod: 4,
    apply: (state) => { if (state.activeProduction) state.activeProduction.totalWeeks += 1; } },
  { title: 'Budget Overrun', description: 'Money is tight. Corners are getting cut in post.', weight: 5, performanceMod: 0, qualityMod: -2, energyMod: 0, stressMod: 2 },
  { title: 'Viral Set Photo', description: 'A behind-the-scenes photo of you is everywhere this week.', weight: 4, performanceMod: 0, qualityMod: 0, energyMod: 0, stressMod: 0,
    apply: (state) => {
      state.player.attributes.starPower = clamp(state.player.attributes.starPower + 0.6, 1, 100);
      state.player.attributes.fanPopularity = clamp(state.player.attributes.fanPopularity + 1.5, 1, 100);
    } },
  { title: 'Director Praises Player', description: 'The director singled you out in front of the crew.', weight: 6, performanceMod: 3, qualityMod: 0, energyMod: 0, stressMod: -5,
    apply: (_s, ws, movie) => { const d = ws.directors.get(movie.directorId); if (d) { d.playerRelationship = clamp(d.playerRelationship + 5, 0, 100); markDirty(ws, 'directors', d.id); } } },
  { title: 'Co-Star Conflict', description: 'Friction with a co-star spilled into the work.', weight: 6, performanceMod: -2, qualityMod: -1, energyMod: 0, stressMod: 7 },
  { title: 'Unexpected Breakthrough Scene', description: 'Something unlocked. Everyone on set felt it.', weight: 3, performanceMod: 5, qualityMod: 2, energyMod: 0, stressMod: -6,
    requires: (s) => s.player.attributes.acting >= 48 },
];

/** Chance any event fires in a given filming week. */
const EVENT_CHANCE = 0.6;
const FILMING_ENERGY_COST = 8;
const FILMING_STRESS_COST = 4;

export function startProduction(state: GameState, movie: Movie, app: Application, role: Role, salary: number): Production {
  const production: Production = {
    movieId: movie.id,
    roleId: role.id,
    characterName: role.characterName,
    roleType: role.roleType,
    salary,
    currentWeek: 0,
    totalWeeks: movie.productionWeeks,
    events: [],
    performanceMod: 0,
    qualityMod: 0,
    prepBonus: app.prepBonus ?? 0,
  };
  state.activeProduction = production;
  return production;
}

/**
 * Advance the active shoot by one week. Returns true when the shoot wrapped this week.
 * Pays the salary on wrap; credits are written by MovieEngine.wrapMovie for the whole cast.
 */
export function tickProduction(state: GameState, ws: WorkingSet, bus: EventBus): boolean {
  const prod = state.activeProduction;
  if (!prod) return false;
  const movie = ws.movies.get(prod.movieId) as Movie;
  const p = state.player;

  prod.currentWeek += 1;
  p.energy = clamp(p.energy - FILMING_ENERGY_COST, 0, 100);
  p.stress = clamp(p.stress + FILMING_STRESS_COST, 0, 100);

  const rng = rngFor(state.worldSeed, movie.id, state.week, `prod-event:${prod.currentWeek}`);
  if (rng.chance(EVENT_CHANCE)) {
    const eligible = EVENTS.filter((e) => !e.requires || e.requires(state));
    const tpl = rng.weighted(eligible.map((e) => ({ item: e, weight: e.weight })));
    const ev: ProductionEvent = {
      week: prod.currentWeek,
      title: tpl.title,
      description: tpl.description,
      performanceMod: tpl.performanceMod,
      qualityMod: tpl.qualityMod,
      energyMod: tpl.energyMod,
      stressMod: tpl.stressMod,
    };
    prod.events.push(ev);
    prod.performanceMod += ev.performanceMod;
    prod.qualityMod += ev.qualityMod;
    movie.productionQualityMod += ev.qualityMod;
    p.energy = clamp(p.energy + ev.energyMod, 0, 100);
    p.stress = clamp(p.stress + ev.stressMod, 0, 100);
    tpl.apply?.(state, ws, movie);
    markDirty(ws, 'movies', movie.id);
    bus.emit('production', `${movie.title} — ${tpl.title}`, `Week ${prod.currentWeek} of ${prod.totalWeeks}: ${tpl.description}`);
  } else {
    bus.emit('production', `${movie.title} — on schedule`, `Week ${prod.currentWeek} of ${prod.totalWeeks}. A steady week on set.`);
  }

  if (prod.currentWeek >= prod.totalWeeks) {
    p.cash += prod.salary;
    p.careerEarnings += prod.salary;
    const xp = addXp(p, 60);
    bus.emit('production', `${movie.title} wraps`, `That's a wrap after ${prod.totalWeeks} weeks. Paid $${prod.salary.toLocaleString()}.${xp.leveledUp ? ` Reached level ${xp.level}!` : ''}`);
    const director = ws.directors.get(movie.directorId);
    if (director) {
      director.playerRelationship = clamp(director.playerRelationship + 2, 0, 100);
      markDirty(ws, 'directors', director.id);
    }
    return true;
  }
  return false;
}
