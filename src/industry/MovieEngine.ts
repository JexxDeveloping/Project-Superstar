/**
 * MovieEngine — the Movie entity's lifecycle for every film in the industry:
 * casting → pre-production → filming → post-production → released → completed,
 * plus the cast bookkeeping (attach, wrap credits, release) other engines rely on.
 */
import {
  type GameState, type Id, type Movie, type Person, type Role, type RoleType, type WorkingSet, markDirty,
} from '../core/GameState';
import type { EventBus } from '../core/EventBus';
import { rngFor } from '../core/RNG';

/** How much of a movie's fate a role can carry (Part 1: Career Box Office Impact). */
export const ROLE_INFLUENCE: Record<RoleType, number> = {
  'Extra': 0.02, 'Minor': 0.10, 'Supporting': 0.25, 'Co-Lead': 0.60, 'Lead': 0.85, 'Main Protagonist': 1.0,
};

export function roleInfluence(role: RoleType): number {
  return ROLE_INFLUENCE[role];
}

const ROLE_RANK: Record<RoleType, number> = {
  'Main Protagonist': 0, 'Lead': 1, 'Co-Lead': 2, 'Supporting': 3, 'Minor': 4, 'Extra': 5,
};

/** Weeks between wrap and release, by budget tier. Bigger films need longer post. */
export function postProductionWeeks(movie: Movie): number {
  switch (movie.budgetTier) {
    case 'Micro Indie': return 5;
    case 'Indie': return 6;
    case 'Small Studio': return 8;
    case 'Medium': return 10;
    case 'Large': return 12;
    case 'Tentpole': return 14;
  }
}

/** Put a person in a role: cast entry, billing, and the person's active list. */
export function attachPerson(ws: WorkingSet, movie: Movie, person: Person, role: Role, salary: number): void {
  role.castPersonId = person.id;
  movie.cast.push({ personId: person.id, roleId: role.id, characterName: role.characterName, roleType: role.roleType, billing: 0, salary });
  // Re-bill by role rank, then by star power within a rank.
  movie.cast
    .slice()
    .sort((a, b) => {
      const r = ROLE_RANK[a.roleType] - ROLE_RANK[b.roleType];
      if (r !== 0) return r;
      return (ws.people.get(b.personId)?.attributes.starPower ?? 0) - (ws.people.get(a.personId)?.attributes.starPower ?? 0);
    })
    .forEach((c, i) => { c.billing = i + 1; });
  if (!person.activeMovieIds.includes(movie.id)) person.activeMovieIds.push(movie.id);
  markDirty(ws, 'movies', movie.id);
  markDirty(ws, 'people', person.id);
}

export function hasPlayer(movie: Movie, playerId: Id): boolean {
  return movie.cast.some((c) => c.personId === playerId);
}

export interface MovieTransition {
  movieId: Id;
  /** `player-ready`: a player film has reached its start week; the orchestrator starts, holds or recasts it. */
  to: 'filming' | 'wrapped' | 'released' | 'player-ready';
}

/** How long a production will push its start to wait for the player before recasting. */
export const MAX_HOLD_WEEKS = 6;

/**
 * Advance every movie by the calendar. Player-attached shoots are driven by ProductionEngine
 * (their wrap comes from there); NPC-only shoots wrap on schedule. A player film that reaches
 * its start week is reported as `player-ready` — the orchestrator starts it, or holds it while
 * the player is on another set (up to MAX_HOLD_WEEKS) and then recasts.
 */
export function tickMovies(state: GameState, ws: WorkingSet, bus: EventBus): MovieTransition[] {
  const out: MovieTransition[] = [];
  const week = state.week;
  const playerId = state.player.id;
  for (const movie of ws.movies.values()) {
    if (movie.status === 'pre-production' && movie.productionStartWeek <= week && hasPlayer(movie, playerId)) {
      out.push({ movieId: movie.id, to: 'player-ready' });
      continue;
    }
    if (movie.status === 'pre-production' && movie.productionStartWeek <= week) {
      movie.status = 'filming';
      markDirty(ws, 'movies', movie.id);
      out.push({ movieId: movie.id, to: 'filming' });
    } else if (movie.status === 'filming' && !hasPlayer(movie, playerId) && movie.productionStartWeek + movie.productionWeeks <= week) {
      out.push({ movieId: movie.id, to: 'wrapped' });
    } else if (movie.status === 'post-production' && movie.releaseWeek !== undefined && movie.releaseWeek <= week) {
      movie.status = 'released';
      markDirty(ws, 'movies', movie.id);
      if (hasPlayer(movie, playerId)) {
        bus.emit('release', `${movie.title} opens in theaters`, 'Opening weekend numbers arrive with the weekly box office.');
      }
      out.push({ movieId: movie.id, to: 'released' });
    }
  }
  return out;
}

/**
 * Mark a movie wrapped: post-production with a release date, credits and pay for the cast,
 * everyone freed for their next job. Q and P are evaluated by their own engines around this.
 */
export function wrapMovie(state: GameState, ws: WorkingSet, movieId: Id): Movie {
  const movie = ws.movies.get(movieId);
  if (!movie) throw new Error(`wrapMovie: unknown movie ${movieId}`);
  const week = state.week;
  movie.status = 'post-production';
  movie.wrapWeek = week;
  movie.releaseWeek = week + postProductionWeeks(movie);
  for (const c of movie.cast) {
    const person = ws.people.get(c.personId);
    if (!person) continue;
    person.activeMovieIds = person.activeMovieIds.filter((id) => id !== movieId);
    person.lastWorkedWeek = week;
    if (!person.filmography.some((f) => f.movieId === movieId)) {
      person.filmography.push({ movieId, characterName: c.characterName, roleType: c.roleType, salary: c.salary, performance: c.performance });
    }
    if (!person.isPlayer) {
      person.cash += c.salary;
      person.careerEarnings += c.salary;
    }
    markDirty(ws, 'people', person.id);
  }
  const director = ws.directors.get(movie.directorId);
  if (director) {
    director.lastWorkedWeek = week;
    if (!director.filmIds.includes(movieId)) director.filmIds.push(movieId);
    // Post-production doesn't need the director on set; they're free to take the next project.
    if (director.activeMovieId === movieId) director.activeMovieId = undefined;
    markDirty(ws, 'directors', director.id);
  }
  markDirty(ws, 'movies', movieId);
  return movie;
}

export function completeMovie(ws: WorkingSet, movieId: Id): void {
  const movie = ws.movies.get(movieId);
  if (!movie) return;
  movie.status = 'completed';
  markDirty(ws, 'movies', movieId);
}

/** Weekly chance a film falls apart before cameras roll, by tier (financing is shakiest at the bottom). */
const CANCEL_CHANCE: Record<Movie['budgetTier'], number> = {
  'Micro Indie': 0.005, 'Indie': 0.004, 'Small Studio': 0.003, 'Medium': 0.0025, 'Large': 0.002, 'Tentpole': 0.0015,
};
const CANCEL_REASONS = [
  'financing fell through', 'the director walked', 'the studio shelved the project', 'a rights dispute stalled it',
  'the lead dropped out and the money went with them', 'a scheduling collapse killed it',
];

/**
 * Productions that die in casting or pre-production. Frees everyone attached. The orchestrator
 * handles the player's booking (and pay-or-play). Returns the cancelled movies.
 */
export function tickCancellations(state: GameState, ws: WorkingSet, bus: EventBus): Movie[] {
  const out: Movie[] = [];
  for (const movie of ws.movies.values()) {
    if (movie.status !== 'casting' && movie.status !== 'pre-production') continue;
    const rng = rngFor(state.worldSeed, movie.id, state.week, 'cancel');
    if (!rng.chance(CANCEL_CHANCE[movie.budgetTier])) continue;
    cancelMovie(state, ws, movie, rng.pick(CANCEL_REASONS));
    out.push(movie);
    if (movie.budget >= 40_000_000 && !hasPlayer(movie, state.player.id)) {
      bus.emit('industry', `${movie.title} collapses in pre-production`, `${ws.studios.get(movie.studioId)?.name}'s $${(movie.budget / 1e6).toFixed(0)}M ${movie.genres.join('/')} is dead: ${movie.cancelledReason}.`);
    }
  }
  return out;
}

/** Kill a production: status, reason, and the bookkeeping on everyone attached (credits included). */
export function cancelMovie(state: GameState, ws: WorkingSet, movie: Movie, reason: string): void {
  {
    movie.status = 'cancelled';
    movie.cancelledWeek = state.week;
    movie.cancelledReason = reason;
    for (const c of movie.cast) {
      const person = ws.people.get(c.personId);
      if (!person) continue;
      person.activeMovieIds = person.activeMovieIds.filter((id) => id !== movie.id);
      // The collapse stays on the record: a credit that never became a film.
      if (!person.filmography.some((f) => f.movieId === movie.id)) {
        person.filmography.push({ movieId: movie.id, characterName: c.characterName, roleType: c.roleType, salary: 0, status: 'cancelled' });
      }
      markDirty(ws, 'people', person.id);
    }
    const director = ws.directors.get(movie.directorId);
    if (director && director.activeMovieId === movie.id) {
      director.activeMovieId = undefined;
      markDirty(ws, 'directors', director.id);
    }
    markDirty(ws, 'movies', movie.id);
  }
}
