import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import type { Movie } from '../core/GameState';
import { evaluatePerformance } from '../industry/PerformanceEngine';
import { evaluateQuality } from '../industry/QualityEngine';
import { openRun, tickRun } from '../industry/BoxOfficeEngine';

const spec = { firstName: 'Test', lastName: 'Actor', gender: 'female' as const, background: 'Film Student' as const, archetype: 'Dramatic Performer' as const };

/** A prestige drama with a strong script and the best director in the universe. */
function prestigeMovie(game: Game): Movie {
  const movies = [...game.ws.movies.values()].filter((m) => m.status !== 'casting');
  const best = [...game.ws.directors.values()].sort((a, b) => b.overall - a.overall)[0];
  const m = movies.sort((a, b) => b.hidden.scriptQuality - a.hidden.scriptQuality)[0];
  m.directorId = best.id;
  m.hidden.scriptQuality = 86;
  m.genres = ['Drama'];
  return m;
}

const leadCtx = { roleType: 'Lead' as const, prepBonus: 0, performanceMod: 0 };

describe('Three independent axes', () => {
  it('a weak actor in a great film: Q high while P low', () => {
    const game = Game.create({ player: spec, seed: 'axes-1', prehistoryWeeks: 20 });
    const movie = prestigeMovie(game);
    const p = game.state.player;
    p.attributes.acting = 22;
    for (const g of Object.keys(p.genres) as (keyof typeof p.genres)[]) p.genres[g] = 15;
    movie.cast.push({ personId: p.id, roleId: 'x', characterName: 'X', roleType: 'Lead', billing: 1, salary: 0 });

    const perf = evaluatePerformance(game.state.worldSeed, 50, p, movie, leadCtx, game.ws);
    const quality = evaluateQuality(game.state.worldSeed, 50, movie, game.ws);
    expect(perf.score).toBeLessThanOrEqual(2);
    expect(quality.q).toBeGreaterThanOrEqual(60);
  });

  it('threshold gating: All-Time (5) is impossible without the fundamentals, across many seeds', () => {
    const game = Game.create({ player: spec, seed: 'axes-2', prehistoryWeeks: 20 });
    const movie = prestigeMovie(game);
    const p = game.state.player;
    p.attributes.acting = 70; // fundamentals ≈ 66 → below the 78 gate
    p.genres.Drama = 60;
    p.energy = 100; p.stress = 0;
    let fives = 0;
    for (let week = 1; week <= 300; week++) {
      const perf = evaluatePerformance(week, week, p, movie, { ...leadCtx, prepBonus: 9 }, game.ws);
      if (perf.score === 5) fives++;
    }
    expect(fives).toBe(0);
  });

  it('with elite fundamentals and favourable circumstances, 5s happen but stay rare', () => {
    const game = Game.create({ player: spec, seed: 'axes-3', prehistoryWeeks: 20 });
    const movie = prestigeMovie(game);
    const d = game.ws.directors.get(movie.directorId)!;
    d.actorDevelopment = 85;
    const p = game.state.player;
    p.attributes.acting = 92;
    p.genres.Drama = 90;
    p.energy = 100; p.stress = 0;
    let fives = 0;
    const N = 400;
    for (let week = 1; week <= N; week++) {
      const perf = evaluatePerformance(week, week, p, movie, { ...leadCtx, prepBonus: 9 }, game.ws);
      if (perf.score === 5) fives++;
    }
    expect(fives).toBeGreaterThan(0);
    expect(fives / N).toBeLessThan(0.6);
  });

  it('commercial result does not read the performance roll; reception drives legs', () => {
    const game = Game.create({ player: spec, seed: 'axes-4', prehistoryWeeks: 20 });
    const base = [...game.ws.movies.values()].find((m) => m.cast.length > 0)!;
    const loved = structuredClone(base);
    const hated = structuredClone(base);
    loved.quality = { q: 80, band: 'Excellent', criticScore: 85, audienceScore: 92, notes: [] };
    hated.quality = { q: 30, band: 'Poor', criticScore: 25, audienceScore: 35, notes: [] };

    const run = (m: typeof loved) => {
      const state = { ...game.state, week: 100 };
      openRun(state, game.ws, m, []);
      while (!tickRun({ ...state, week: state.week + 1 }, m, []).finished) state.week++;
      return m.boxOffice!;
    };
    const a = run(loved);
    const b = run(hated);
    expect(a.worldwide / a.openingDomestic).toBeGreaterThan(b.worldwide / b.openingDomestic);
    expect(a.weeks.length).toBeGreaterThanOrEqual(b.weeks.length);
    const dropA = 1 - a.weeks[1].domestic / a.weeks[0].domestic;
    const dropB = 1 - b.weeks[1].domestic / b.weeks[0].domestic;
    expect(dropA).toBeLessThan(dropB);
  });
});
