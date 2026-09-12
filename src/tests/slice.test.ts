/**
 * Headless vertical slice: a simple policy plays weeks until one audition → production → release
 * cycle completes, and the same seed replays identically.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import type { MovieResult } from '../core/GameState';

const spec = { firstName: 'Clyde', lastName: 'Osborne', gender: 'male' as const, background: 'Film Student' as const, archetype: 'Jack of All Trades' as const };

/** A naive but legal player: apply to everything, prep, accept, train, rest when tired. */
function playUntilResult(seed: string, maxWeeks = 400): { result: MovieResult; weeks: number; game: Game } {
  const game = Game.create({ player: spec, seed });
  for (let i = 0; i < maxWeeks; i++) {
    const s = game.state;
    for (const app of s.applications) {
      if (app.status === 'audition_pending' && !app.prep) game.choosePrep(app.listingId, 'Practice Scene');
      if (app.status === 'offer') { try { game.acceptOffer(app.listingId); } catch { game.declineOffer(app.listingId); } }
    }
    // The café job costs energy every week; a sensible rookie rests first (and quits it once solvent).
    if (s.dayJob && s.player.cash > 6_000) game.quitDayJob();
    if (s.player.energy < 60 || s.player.stress > 60) game.planAction({ type: 'rest' });
    for (const l of s.listings) {
      if (game.actionsRemaining === 0) break;
      try { game.planAction({ type: 'apply', listingId: l.id }); } catch { /* blocked: fine */ }
    }
    // Spare actions: a class when rested and solvent, a prep week only when there's a role to prep, else nothing.
    while (game.actionsRemaining > 0) {
      if (s.player.cash > 1000 && s.player.energy > 70) game.planAction({ type: 'acting_class' });
      else if (s.activeProduction || s.applications.some((a) => a.status === 'booked')) game.planAction({ type: 'prepare_role' });
      else break;
    }
    game.endWeek();
    if (s.pendingResults.length > 0) return { result: s.pendingResults[0], weeks: i + 1, game };
  }
  throw new Error('No result within the week budget');
}

describe('Vertical slice — audition → book → produce → release → 3-axis result', () => {
  it('completes a full cycle headlessly', () => {
    const { result, weeks, game } = playUntilResult('slice-1');
    expect(weeks).toBeLessThan(120);
    expect([1, 2, 3, 4, 5]).toContain(result.performance.score);
    expect(result.quality.q).toBeGreaterThanOrEqual(0);
    expect(result.quality.q).toBeLessThanOrEqual(100);
    expect(result.boxOffice.finished).toBe(true);
    expect(result.boxOffice.verdict).toBeDefined();
    expect(result.boxOffice.weeks.length).toBeGreaterThanOrEqual(4);
    expect(result.boxOffice.worldwide).toBeGreaterThan(0);
    expect(result.headline.length).toBeGreaterThan(10);
    // Career bookkeeping happened.
    expect(game.state.player.filmography.length).toBeGreaterThanOrEqual(1);
    expect(game.state.player.careerEarnings).toBeGreaterThan(0);
    // A second booking may already be shooting; the resolved film itself is done.
    expect(game.state.activeProduction?.movieId).not.toBe(result.movieId);
    const movie = game.ws.movies.get(result.movieId)!;
    expect(movie.status).toBe('completed');
    expect(movie.cast.some((c) => c.personId === game.state.player.id)).toBe(true);
  });

  it('is deterministic: the same seed produces the same result', () => {
    const a = playUntilResult('slice-2');
    const b = playUntilResult('slice-2');
    expect(a.weeks).toBe(b.weeks);
    expect(a.result).toEqual(b.result);
    expect(a.game.state).toEqual(b.game.state);
  });

  it('different seeds produce different stories', () => {
    const results = ['seed-a', 'seed-b', 'seed-c', 'seed-d'].map((s) => playUntilResult(s).result);
    const signatures = new Set(results.map((r) => `${r.movieId}|${r.performance.score}|${r.boxOffice.verdict}|${r.boxOffice.worldwide}`));
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('keeps the audition board alive for a long stretch of weeks', () => {
    const game = Game.create({ player: spec, seed: 'long-run' });
    let weeksWithListings = 0;
    for (let i = 0; i < 200; i++) {
      game.planAction({ type: 'rest' });
      game.endWeek();
      if (game.state.listings.length > 0) weeksWithListings++;
    }
    expect(game.state.week).toBe(8 + 200);
    expect(weeksWithListings).toBeGreaterThan(160);
  });
});
