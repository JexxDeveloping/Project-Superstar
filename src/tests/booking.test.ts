/**
 * Regression: two bookings must never deadlock the career.
 * A film whose shoot arrives while the player is on another set waits, then recasts; a stranded
 * "filming" film with no shoot running (old saves) starts its shoot; overlapping offers are refused.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import type { AuditionListing, Movie } from '../core/GameState';
import { attachPerson, MAX_HOLD_WEEKS } from '../industry/MovieEngine';

const spec = { firstName: 'Double', lastName: 'Booker', gender: 'male' as const, background: 'Theater Actor' as const, archetype: 'Method Actor' as const };

/** Pick a casting movie with an uncast role the player fits, and hand it to the player as if booked. */
function bookPlayerOn(game: Game, exclude: string[] = []): Movie {
  const s = game.state;
  const movie = [...game.ws.movies.values()].find((m) =>
    m.status === 'casting' && !exclude.includes(m.id) && m.roles.some((r) => !r.castPersonId && r.genderPref !== 'female'))!;
  const role = movie.roles.find((r) => !r.castPersonId && r.genderPref !== 'female')!;
  attachPerson(game.ws, movie, s.player, role, role.salary);
  s.trackedMovieIds.push(movie.id);
  s.applications.push({
    listingId: `l-${role.id}`, movieId: movie.id, roleId: role.id, movieTitle: movie.title, characterName: role.characterName,
    roleType: role.roleType, appliedWeek: s.week, status: 'booked', auditionScore: 60, directorReaction: 'Fine.', prepBonus: 1,
  });
  return movie;
}

function listingFor(movie: Movie): AuditionListing {
  const role = movie.roles.find((r) => !r.castPersonId)!;
  return {
    id: `l-${role.id}`, movieId: movie.id, roleId: role.id, characterName: role.characterName, roleType: role.roleType,
    expectedSalary: role.salary, difficulty: role.difficulty, requiredActing: role.requiredActing, preferredGenre: movie.genres[0],
    estimatedPrestige: 'Moderate', estimatedCommercial: 'Moderate', competitorIds: [], postedWeek: 0, expiresWeek: 999,
  };
}

describe('Double booking', () => {
  it('overlapping shoots: the second film waits, then recasts — the career never stalls', () => {
    const game = Game.create({ player: spec, seed: 'double-1', prehistoryWeeks: 30 });
    const s = game.state;
    const a = bookPlayerOn(game);
    const b = bookPlayerOn(game, [a.id]);
    // Force a hard overlap: both shoots start the same week and run long.
    a.productionStartWeek = s.week + 2; a.productionWeeks = 10; a.castingCloseWeek = s.week + 1;
    b.productionStartWeek = s.week + 2; b.productionWeeks = 10; b.castingCloseWeek = s.week + 1;

    let sawHold = false;
    let sawReplace = false;
    for (let i = 0; i < 60; i++) {
      game.planAction({ type: 'rest' });
      const ev = game.endWeek();
      if (ev.some((e) => e.title.includes('is waiting for you'))) sawHold = true;
      if (ev.some((e) => e.title.startsWith('Replaced on'))) sawReplace = true;
    }
    expect(sawHold).toBe(true);
    expect(sawReplace).toBe(true);
    expect(s.activeProduction).toBeNull();
    // Nothing is left hanging: no booked application whose film already left pre-production.
    for (const app of s.applications) {
      if (app.status !== 'booked') continue;
      const m = game.ws.movies.get(app.movieId)!;
      expect(m.status).toBe('pre-production');
    }
    const first = game.ws.movies.get(a.id)!;
    const second = game.ws.movies.get(b.id)!;
    expect(first.cast.some((c) => c.personId === s.player.id)).toBe(true);
    expect(second.cast.some((c) => c.personId === s.player.id)).toBe(false);
    expect(second.roles.every((r) => r.castPersonId)).toBe(true);
    expect(second.holdWeeks).toBe(MAX_HOLD_WEEKS + 1);
    // The player is free to apply again.
    expect(s.player.activeMovieIds.length).toBeLessThanOrEqual(1);
  });

  it('a stranded "filming" film with no shoot running starts its shoot on the next week', () => {
    const game = Game.create({ player: spec, seed: 'double-2', prehistoryWeeks: 30 });
    const s = game.state;
    const m = bookPlayerOn(game);
    for (const r of m.roles) if (!r.castPersonId) r.castPersonId = 'ghost';
    m.status = 'filming';
    m.productionStartWeek = s.week - 3;
    expect(s.activeProduction).toBeNull();
    game.planAction({ type: 'rest' });
    game.endWeek();
    expect(s.activeProduction?.movieId).toBe(m.id);
    expect(s.applications.find((a) => a.movieId === m.id)?.status).toBe('in_production');
  });

  it('refuses an offer whose shoot overlaps a booking, allows one that does not', () => {
    const game = Game.create({ player: spec, seed: 'double-3', prehistoryWeeks: 30 });
    const s = game.state;
    const booked = bookPlayerOn(game);
    booked.productionStartWeek = s.week + 4; booked.productionWeeks = 6;
    const others = [...game.ws.movies.values()].filter((m) => m.status === 'casting' && m.id !== booked.id && m.roles.some((r) => !r.castPersonId));
    const overlap = others[0];
    const clear = others[1];
    overlap.productionStartWeek = s.week + 6; overlap.productionWeeks = 4; // inside the booked window
    clear.productionStartWeek = s.week + 14; clear.productionWeeks = 4; // after it, with buffer

    for (const m of [overlap, clear]) {
      const l = listingFor(m);
      s.listings.push(l);
      s.applications.push({ listingId: l.id, movieId: m.id, roleId: l.roleId, movieTitle: m.title, characterName: l.characterName, roleType: l.roleType, appliedWeek: s.week, status: 'offer', auditionScore: 70 });
    }
    expect(() => game.acceptOffer(`l-${overlap.roles.find((r) => !r.castPersonId)!.id}`)).toThrow(/overlaps/);
    expect(() => game.acceptOffer(listingFor(clear).id)).not.toThrow();
    expect(s.applications.filter((a) => a.status === 'booked').length).toBe(2);
  });
});
