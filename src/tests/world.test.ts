/**
 * The living world: with no player input, the industry keeps producing, casting, releasing and
 * turning over its population — deterministically, within sane distributions, and fast.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { generateTitle } from '../gen/TitleGen';
import { generatePersonName } from '../gen/NameGen';
import { Rng } from '../core/RNG';
import type { Verdict } from '../core/GameState';

const spec = { firstName: 'Idle', lastName: 'Player', gender: 'female' as const, background: 'Complete Unknown' as const, archetype: 'Jack of All Trades' as const };

function runYears(seed: string, years: number): Game {
  const game = Game.create({ player: spec, seed });
  for (let w = 0; w < years * 52; w++) {
    game.planAction({ type: 'rest' });
    game.endWeek();
  }
  return game;
}

describe('Generators', () => {
  it('names and titles are deterministic and unique', () => {
    const a = new Rng(7); const b = new Rng(7);
    const ta = new Set<string>(); const tb = new Set<string>();
    const titlesA = Array.from({ length: 200 }, () => generateTitle(a, ['Drama'], ta));
    const titlesB = Array.from({ length: 200 }, () => generateTitle(b, ['Drama'], tb));
    expect(titlesA).toEqual(titlesB);
    expect(new Set(titlesA.map((t) => t.toLowerCase())).size).toBe(200);

    const na = new Set<string>();
    const names = Array.from({ length: 300 }, () => generatePersonName(a, 'male', na));
    expect(new Set(names.map((n) => `${n.firstName} ${n.lastName}`)).size).toBe(300);
  });
});

describe('Living world — 10 idle years', () => {
  const game = runYears('world-test', 10);
  const movies = [...game.ws.movies.values()];
  const completed = movies.filter((m) => m.status === 'completed');
  const people = [...game.ws.people.values()].filter((p) => !p.isPlayer);

  it('produces a steady slate of films every year', () => {
    const byYear = new Map<number, number>();
    for (const m of movies) {
      const y = Math.floor(m.announcedWeek / 52);
      byYear.set(y, (byYear.get(y) ?? 0) + 1);
    }
    const years = [...byYear.entries()].filter(([y]) => y >= 1 && y <= 9).map(([, n]) => n);
    expect(years.length).toBe(9);
    for (const n of years) expect(n).toBeGreaterThanOrEqual(35);
    expect(completed.length).toBeGreaterThan(400);
  });

  it('every non-casting movie is fully cast, and nothing gets stuck', () => {
    for (const m of movies) {
      if (m.status === 'casting' || m.status === 'cancelled') continue;
      expect(m.roles.every((r) => r.castPersonId)).toBe(true);
      expect(m.cast.length).toBe(m.roles.length);
      expect(game.state.week - m.announcedWeek < 120 || m.status === 'completed').toBe(true);
    }
    for (const m of completed) {
      expect(m.quality).toBeDefined();
      expect(m.boxOffice?.finished).toBe(true);
      expect(m.cast.every((c) => c.performance)).toBe(true);
    }
  });

  it('box office spreads across verdicts and is not budget × constant', () => {
    const counts: Partial<Record<Verdict, number>> = {};
    for (const m of completed) counts[m.boxOffice!.verdict!] = (counts[m.boxOffice!.verdict!] ?? 0) + 1;
    const share = (v: Verdict) => (counts[v] ?? 0) / completed.length;
    expect(share('Flop') + share('Disaster')).toBeGreaterThan(0.1);
    expect(share('Average')).toBeGreaterThan(0.2);
    expect(share('Average')).toBeLessThan(0.65);
    expect(share('Hit') + share('Super Hit') + share('Blockbuster') + share('All-Time Blockbuster')).toBeGreaterThan(0.15);
    const ratios = completed.map((m) => m.boxOffice!.worldwide / m.budget).sort((a, b) => a - b);
    const median = ratios[Math.floor(ratios.length / 2)];
    expect(median).toBeGreaterThan(0.8);
    expect(median).toBeLessThan(1.7);
    expect(ratios[Math.floor(ratios.length * 0.9)] / ratios[Math.floor(ratios.length * 0.1)]).toBeGreaterThan(2.5);
  });

  it('star power stays a pyramid — no inflation', () => {
    const active = people.filter((p) => p.status === 'active');
    const stars = active.map((p) => p.attributes.starPower);
    expect(stars.filter((s) => s >= 85).length).toBeLessThanOrEqual(8);
    expect(stars.filter((s) => s >= 85).length).toBeGreaterThanOrEqual(1);
    expect(stars.filter((s) => s < 50).length / stars.length).toBeGreaterThan(0.6);
    expect(Math.max(...active.map((p) => p.attributes.acting))).toBeLessThanOrEqual(100);
    const busiest = Math.max(...active.map((p) => p.filmography.length));
    expect(busiest).toBeLessThan(50);
  });

  it('some productions collapse, and nobody stays attached to a dead film', () => {
    const cancelled = movies.filter((m) => m.status === 'cancelled');
    expect(cancelled.length).toBeGreaterThan(0);
    expect(cancelled.length / movies.length).toBeLessThan(0.15);
    const dead = new Set(cancelled.map((m) => m.id));
    for (const p of people) for (const id of p.activeMovieIds) expect(dead.has(id)).toBe(false);
    for (const d of game.ws.directors.values()) if (d.activeMovieId) expect(dead.has(d.activeMovieId)).toBe(false);
  });

  it('the population turns over: cohorts enter, actors retire, directors emerge', () => {
    expect(people.length).toBeGreaterThan(200);
    expect(people.filter((p) => p.status === 'retired').length).toBeGreaterThan(20);
    expect(people.filter((p) => p.startWeek > game.state.week - 52 * 2).length).toBeGreaterThan(15);
    expect(game.ws.directors.size).toBeGreaterThan(35);
  });

  it('the player still saw an audition board and the world produced headlines', () => {
    expect(game.state.timeline.some((e) => e.category === 'industry')).toBe(true);
    expect(game.state.timeline.some((e) => e.title === 'New casting call')).toBe(true);
  });
});

describe('Living world — determinism and speed', () => {
  it('the same seed replays the same universe', () => {
    const a = runYears('det-1', 3);
    const b = runYears('det-1', 3);
    expect(a.ws.movies.size).toBe(b.ws.movies.size);
    for (const [id, m] of a.ws.movies) expect(b.ws.movies.get(id)).toEqual(m);
    expect([...a.ws.people.values()]).toEqual([...b.ws.people.values()]);
  });

  it('40 idle years run in a few seconds', () => {
    const t0 = performance.now();
    const game = runYears('speed', 40);
    const secs = (performance.now() - t0) / 1000;
    expect(secs).toBeLessThan(15);
    expect(game.state.week).toBe(8 + 40 * 52);
    expect([...game.ws.movies.values()].filter((m) => m.status === 'completed').length).toBeGreaterThan(1800);
  });
});
