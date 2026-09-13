/**
 * Phase 4: the box office engine (Part 3 behavioural spec), the release calendar, word of mouth,
 * the recoupment verdict with its era gate, tracking, records, genre trends, and the per-entity
 * history the profile pages will read.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { EventBus } from '../core/EventBus';
import type { GameState, Movie, Verdict } from '../core/GameState';
import {
  allTimeGate, commercialImpacts, expectedOpening, fameScale, finishRun, marketingIntensity, openRun, tickRun, trackingReport, weekNote, womBand,
} from '../industry/BoxOfficeEngine';
import {
  audienceOverlap, bumpSmallerRivals, campaignBand, chooseReleaseWeek, competitionPressure, genreWindowFactor, marketSize, windowName, weekOfYear,
} from '../world/ReleaseCalendarEngine';
import { TREND_MAX, TREND_MIN, tickGenreTrends } from '../world/TrendEngine';
import { GENRES } from '../core/GameState';

const spec = { firstName: 'Box', lastName: 'Office', gender: 'female' as const, background: 'Film Student' as const, archetype: 'Dramatic Performer' as const };

function worldWithFilms(seed: string, years = 3): Game {
  const game = Game.create({ player: spec, seed });
  for (let w = 0; w < years * 52; w++) { game.planAction({ type: 'rest' }); game.endWeek(); }
  return game;
}

/** Run a film's box office headlessly outside the tick, with no rivals. */
function playRun(state: GameState, game: Game, m: Movie, startWeek: number): Movie['boxOffice'] {
  const s = { ...state, week: startWeek };
  openRun(s, game.ws, m, []);
  m.boxOffice!.weeks[0].note = { kind: 'opened_first' };
  for (;;) {
    s.week += 1;
    const out = tickRun(s, m, []);
    m.boxOffice!.weeks[m.boxOffice!.weeks.length - 1].note = weekNote(out, s.week);
    if (out.finished) break;
  }
  finishRun(game.ws, m, s.week, 0);
  return m.boxOffice;
}

describe('Release calendar', () => {
  it('market tables peak at the holidays and dip in the dead zones', () => {
    expect(marketSize('domestic', 50)).toBeGreaterThan(1.4); // Christmas
    expect(marketSize('domestic', 26)).toBeGreaterThan(1.3); // July 4
    expect(marketSize('domestic', 46)).toBeGreaterThan(1.3); // Thanksgiving
    expect(marketSize('domestic', 34)).toBeLessThan(0.85); // early September
    expect(marketSize('international', 50)).toBeGreaterThan(1.3);
    expect(windowName(50)).toBe('Christmas');
    expect(windowName(26)).toBe('July 4');
    expect(windowName(5)).toBe("Valentine's");
    expect(windowName(42)).toBe('Halloween');
    expect(weekOfYear(-3)).toBe(49);
  });

  it('genres react to windows: romance at Valentine\'s, horror at Halloween, family at Christmas', () => {
    expect(genreWindowFactor(['Romance'], 5)).toBeGreaterThan(1.2);
    expect(genreWindowFactor(['Horror'], 42)).toBeGreaterThan(1.3);
    expect(genreWindowFactor(['Family'], 50)).toBeGreaterThan(1.2);
    expect(genreWindowFactor(['Horror'], 50)).toBeLessThan(1);
    expect(genreWindowFactor(['Action'], 26)).toBeGreaterThan(1.2);
    expect(genreWindowFactor(['Crime'], 2)).toBe(1);
  });

  it('audience overlap and competitive pressure behave', () => {
    const action = { genres: ['Action' as const], budgetTier: 'Large' as const };
    const drama = { genres: ['Drama' as const], budgetTier: 'Small Studio' as const };
    const scifi = { genres: ['Science Fiction' as const], budgetTier: 'Large' as const };
    expect(audienceOverlap(action, action)).toBe(1);
    expect(audienceOverlap(action, scifi)).toBeGreaterThan(audienceOverlap(action, drama));
    expect(competitionPressure(action, 100, [])).toBe(0);
    expect(competitionPressure(action, 100, [{ movie: scifi, size: 400 }])).toBeGreaterThan(competitionPressure(action, 100, [{ movie: scifi, size: 25 }]));
  });

  it('studios claim dates at or after post-production allows, preferring bigger windows for their genre', () => {
    const game = worldWithFilms('cal-1', 2);
    const m = [...game.ws.movies.values()].find((x) => x.status === 'completed')!;
    const test = structuredClone(m);
    test.id = 'm-test-cal';
    test.genres = ['Horror'];
    test.budgetTier = 'Small Studio';
    // Earliest possible week is the first week of October: the studio should hold for Halloween.
    const octoberWeek1 = Math.floor(game.state.week / 52) * 52 + 52 + 39;
    const chosen = chooseReleaseWeek(game.state, game.ws, test, octoberWeek1);
    expect(chosen).toBeGreaterThanOrEqual(octoberWeek1);
    expect([41, 42]).toContain(weekOfYear(chosen));
  });

  it('a much bigger film landing on a smaller one\'s week can move it — rarely, with a news line', () => {
    const game = worldWithFilms('cal-bump', 2);
    const state = game.state;
    const post = [...game.ws.movies.values()].filter((m) => m.status === 'post-production' && m.releaseWeek !== undefined);
    expect(post.length).toBeGreaterThan(0);
    const small = post.sort((a, b) => a.budget - b.budget)[0];
    // Manufacture a tentpole with the same audience on the same week, then re-run the scheduling step many times.
    let moved = 0;
    let newsLines = 0;
    for (let k = 0; k < 40; k++) {
      const clone = structuredClone(small);
      clone.id = `m-big-${k}`;
      clone.title = `Giant ${k}`;
      clone.budget = small.budget * 100 + 200_000_000;
      clone.budgetTier = 'Tentpole';
      clone.marketingBudget = clone.budget;
      clone.cast = [];
      game.ws.movies.set(clone.id, clone);
      const victim = structuredClone(small);
      victim.id = `m-small-${k}`;
      victim.wrapWeek = state.week - 30;
      game.ws.movies.set(victim.id, victim);
      const before = victim.releaseWeek!;
      const bus = new EventBus(state.week);
      clone.status = 'post-production';
      clone.releaseWeek = before;
      // The date is fixed by hand so the rival pass is exercised alone.
      bumpSmallerRivals({ ...state, week: state.week + k }, game.ws, clone, bus);
      if (victim.releaseWeek !== before) {
        moved += 1;
        expect(Math.abs(victim.releaseWeek! - before)).toBeLessThanOrEqual(2);
        expect((victim.dateMoves ?? 0) >= 1).toBe(true);
        if (bus.events().some((e) => e.title.includes(`moves ${victim.title}`))) newsLines += 1;
      }
      game.ws.movies.delete(clone.id);
      game.ws.movies.delete(victim.id);
    }
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(40);
    expect(newsLines).toBe(moved);
  });

  it('campaign band reads the studio\'s marketing decision', () => {
    expect(campaignBand({ budget: 10_000_000, marketingBudget: 12_000_000, budgetTier: 'Small Studio' })).toBe('heavy');
    expect(campaignBand({ budget: 10_000_000, marketingBudget: 8_000_000, budgetTier: 'Small Studio' })).toBe('modest');
    expect(campaignBand({ budget: 10_000_000, marketingBudget: 4_000_000, budgetTier: 'Small Studio' })).toBe('minimal');
    expect(marketingIntensity({ budget: 10_000_000, marketingBudget: 8_000_000, budgetTier: 'Small Studio' })).toBeCloseTo(1, 6);
  });
});

describe('Box office model', () => {
  const game = worldWithFilms('bo-model', 2);
  const state = game.state;
  const base = [...game.ws.movies.values()].find((m) => m.status === 'completed' && m.cast.length > 0)!;
  const quietWeek = Math.floor(state.week / 52) * 52 + 52 + 14; // mid-April, no window

  it('retention can exceed 100%: a small-opening film audiences love grows in weeks 2–4 (the sleeper)', () => {
    const m = structuredClone(base);
    m.id = 'm-sleeper';
    m.genres = ['Drama'];
    m.budgetTier = 'Indie';
    m.budget = 3_000_000;
    m.marketingBudget = 600_000; // minimal campaign: nobody heard of it
    m.quality = { q: 82, band: 'Excellent', criticScore: 88, audienceScore: 90, notes: [] };
    m.cast = []; // no names
    const run = playRun(state, game, m, quietWeek)!;
    expect(run.peakWeek).toBeGreaterThan(1);
    expect(run.weeks[1].domestic).toBeGreaterThan(run.weeks[0].domestic);
    expect(run.weeks.some((w) => w.note?.kind === 'grew')).toBe(true);
    expect(run.tags).toContain('Sleeper');
    expect(run.totalDomestic / run.openingDomestic).toBeGreaterThan(5);
  });

  it('toxic word of mouth collapses a film 60–80% in week 2; great buzz holds under ~35%', () => {
    const loved = structuredClone(base);
    loved.id = 'm-loved';
    loved.quality = { q: 80, band: 'Excellent', criticScore: 85, audienceScore: 90, notes: [] };
    const hated = structuredClone(base);
    hated.id = 'm-hated';
    hated.quality = { q: 25, band: 'Poor', criticScore: 18, audienceScore: 20, notes: [] };
    hated.marketingBudget = hated.budget * 1.5; // oversold
    const a = playRun(state, game, loved, quietWeek)!;
    const b = playRun(state, game, hated, quietWeek)!;
    const dropA = 1 - a.weeks[1].domestic / a.weeks[0].domestic;
    const dropB = 1 - b.weeks[1].domestic / b.weeks[0].domestic;
    expect(dropB).toBeGreaterThan(0.6);
    expect(dropB).toBeLessThan(0.85);
    expect(dropA).toBeLessThan(0.35);
    expect(b.weeks[1].wom).toBe('toxic');
    expect(a.weeks[1].wom).toBe('strong');
    expect(a.weeks.length).toBeGreaterThan(b.weeks.length);
    expect(womBand(80)).toBe('strong');
    expect(womBand(60)).toBe('building');
    expect(womBand(45)).toBe('fading');
    expect(womBand(20)).toBe('toxic');
  });

  it('the seasonal ratio lifts the whole market: a holdover rolling into Christmas week goes up', () => {
    const m = structuredClone(base);
    m.id = 'm-xmas';
    m.genres = ['Family'];
    m.quality = { q: 68, band: 'Good', criticScore: 70, audienceScore: 78, notes: [] };
    const xmas = Math.floor(state.week / 52) * 52 + 52 + 50;
    const run = playRun(state, game, m, xmas - 1)!; // opens the week before Christmas
    expect(run.weeks[1].domestic).toBeGreaterThan(run.weeks[0].domestic);
    expect(run.weeks[1].note?.kind).toBe('holiday');
    expect(run.weeks[1].note?.window).toBe('Christmas');
    expect(run.peakWeek).toBe(2);
  });

  it('opening is awareness (marketing, stars, window, competition), not reception', () => {
    const m = structuredClone(base);
    m.id = 'm-aware';
    m.quality = { q: 30, band: 'Poor', criticScore: 30, audienceScore: 35, notes: [] };
    const week = quietWeek;
    const quiet = expectedOpening(state, game.ws, m, week, []);
    const heavy = structuredClone(m);
    heavy.marketingBudget = m.marketingBudget * 2;
    expect(expectedOpening(state, game.ws, heavy, week, [])).toBeGreaterThan(quiet * 1.2);
    const rival = { movie: structuredClone(m), size: quiet * 3 };
    expect(expectedOpening(state, game.ws, m, week, [rival])).toBeLessThan(quiet * 0.8);
    const july4 = Math.floor(state.week / 52) * 52 + 52 + 26;
    expect(expectedOpening(state, game.ws, m, july4, [])).toBeGreaterThan(quiet * 1.2);
    // Reception barely touches the opening; it owns the legs.
    const great = structuredClone(m);
    great.quality = { q: 85, band: 'Excellent', criticScore: 90, audienceScore: 90, notes: [] };
    expect(expectedOpening(state, game.ws, great, week, [])).toBeLessThan(quiet * 1.2);
  });

  it('runs end near 2% of the peak week or at 16 weeks, never under 4', () => {
    for (const m of [...game.ws.movies.values()].filter((x) => x.status === 'completed').slice(0, 60)) {
      const r = m.boxOffice!;
      expect(r.weeks.length).toBeGreaterThanOrEqual(4);
      expect(r.weeks.length).toBeLessThanOrEqual(16);
    }
  });

  it('the same seed replays the same run; different weeks differ', () => {
    const m1 = structuredClone(base); m1.id = 'm-det';
    const m2 = structuredClone(base); m2.id = 'm-det';
    const m3 = structuredClone(base); m3.id = 'm-det';
    const a = playRun(state, game, m1, quietWeek)!;
    const b = playRun(state, game, m2, quietWeek)!;
    const c = playRun(state, game, m3, quietWeek + 7)!;
    expect(a).toEqual(b);
    expect(c.openingDomestic).not.toBe(a.openingDomestic);
  });
});

describe('Verdict, gate, tracking, fame vs trust', () => {
  const game = worldWithFilms('bo-verdict', 3);
  const state = game.state;
  const completed = [...game.ws.movies.values()].filter((m) => m.status === 'completed');

  it('every finished run has recoup = (take + afterlife) / (budget + marketing) and a verdict on the ladder', () => {
    for (const m of completed) {
      const r = m.boxOffice!;
      const take = r.totalDomestic * 0.5 + r.totalInternational * 0.4;
      expect(r.theatricalTake).toBe(Math.round(take));
      expect(r.recoup).toBeCloseTo((take + r.afterlife!) / (m.budget + m.marketingBudget), 2);
      expect(Math.abs(r.profit! - (take + r.afterlife! - (m.budget + m.marketingBudget)))).toBeLessThanOrEqual(1);
      const v: Verdict = r.verdict!;
      const ladder: [number, Verdict][] = [[0, 'Disaster'], [0.4, 'Flop'], [0.75, 'Average'], [1.1, 'Hit'], [1.5, 'Super Hit'], [2, 'Blockbuster'], [3, 'All-Time Blockbuster']];
      // The stored recoup is rounded to 3 decimals; a film within that of a cutoff may sit on either side.
      const near = ladder.some(([min]) => min > 0 && Math.abs(r.recoup! - min) < 0.002);
      const expected = ladder.filter(([min]) => r.recoup! >= min).pop()![1];
      if (expected === 'All-Time Blockbuster') expect(['All-Time Blockbuster', 'Blockbuster']).toContain(v);
      else if (near) expect(Math.abs(ladder.findIndex(([, l]) => l === v) - ladder.findIndex(([, l]) => l === expected))).toBeLessThanOrEqual(1);
      else expect(v).toBe(expected);
    }
  });

  it('the All-Time gate is era-relative: the 10th-biggest gross of the last five years, or every film when fewer than ten', () => {
    const gate = allTimeGate(game.ws, state.week);
    const recent = completed.filter((m) => m.boxOffice!.weeks[m.boxOffice!.weeks.length - 1].week >= state.week - 260).map((m) => m.boxOffice!.worldwide).sort((a, b) => b - a);
    expect(gate).toBe(recent[9]);
    // Cold start: a fresh working set with three finished films — the gate is the biggest of them.
    const tiny = { ...game.ws, movies: new Map([...game.ws.movies].filter(([, m]) => m.status === 'completed').slice(0, 3)) };
    const grosses = [...tiny.movies.values()].map((m) => m.boxOffice!.worldwide);
    expect(allTimeGate(tiny, state.week)).toBe(Math.max(...grosses));
    expect(allTimeGate({ ...game.ws, movies: new Map() }, state.week)).toBe(0);
    // A film tripling its cost on a tiny gross is a Blockbuster, not an all-timer.
    const m = structuredClone(completed[0]);
    m.boxOffice = { ...m.boxOffice!, totalDomestic: 5_000_000, totalInternational: 5_000_000, worldwide: 10_000_000 };
    m.budget = 1_000_000; m.marketingBudget = 500_000;
    finishRun(game.ws, m, state.week, 500_000_000);
    expect(m.boxOffice.recoup).toBeGreaterThan(3);
    expect(m.boxOffice.verdict).toBe('Blockbuster');
  });

  it('tracking brackets the fundamentals and narrows with accuracy', () => {
    const m = [...game.ws.movies.values()].find((x) => x.status === 'post-production' && x.releaseWeek !== undefined)!;
    const loose = trackingReport(state, game.ws, m, 0);
    const tight = trackingReport(state, game.ws, m, 1);
    expect(loose.high / loose.low).toBeGreaterThan(tight.high / tight.low);
    const expected = expectedOpening(state, game.ws, m, m.releaseWeek!, []);
    expect(loose.low).toBeLessThan(expected * 1.15);
    expect(loose.high).toBeGreaterThan(expected * 0.85);
  });

  it('fame follows gross, trust follows verdict', () => {
    const m = completed[0];
    const big = { ...m.boxOffice!, worldwide: 800_000_000, verdict: 'Flop' as const, wom: 50 };
    const small = { ...m.boxOffice!, worldwide: 3_000_000, verdict: 'Super Hit' as const, wom: 50 };
    const a = commercialImpacts(m, 'Lead', big, game.ws);
    const b = commercialImpacts(m, 'Lead', small, game.ws);
    const get = (d: typeof a, t: string) => d.find((x) => x.target === t)!.amount;
    expect(get(a, 'starPower')).toBeGreaterThan(get(b, 'starPower'));
    expect(get(a, 'fanPopularity')).toBeGreaterThan(get(b, 'fanPopularity'));
    expect(get(b, 'momentum')).toBeGreaterThan(get(a, 'momentum'));
    expect(get(b, `studio:${m.studioId}`)).toBeGreaterThan(get(a, `studio:${m.studioId}`));
    expect(fameScale(1_000_000_000)).toBeGreaterThan(fameScale(100_000_000));
    // A break-even indie still advances a rookie through exposure + fame.
    const indie = { ...m.boxOffice!, worldwide: 2_000_000, verdict: 'Average' as const, wom: 55 };
    expect(get(commercialImpacts(m, 'Lead', indie, game.ws), 'starPower')).toBeGreaterThan(0);
  });

  it('records, reviews, genre trends and per-entity history are kept', () => {
    expect(state.records.allTime.gross).toBeDefined();
    expect(state.records.allTime.opening).toBeDefined();
    expect(Object.keys(state.records.byYear).length).toBeGreaterThan(1);
    for (const m of completed) {
      expect(m.reviews!.critics.length).toBe(2);
      expect(m.reviews!.audience.length).toBeGreaterThan(5);
      expect(['live-action', 'animation']).toContain(m.type);
      expect(m.runtime).toBeGreaterThan(70);
      expect(m.plot.length).toBeGreaterThan(10);
    }
    for (const g of GENRES) {
      expect(state.genreTrends[g]).toBeGreaterThanOrEqual(TREND_MIN);
      expect(state.genreTrends[g]).toBeLessThanOrEqual(TREND_MAX);
    }
    const before = { ...state.genreTrends };
    const yearStart = { ...state, week: 52 * 10 };
    tickGenreTrends(yearStart);
    expect(GENRES.some((g) => yearStart.genreTrends[g] !== before[g])).toBe(true);
    // People: cumulative gross + review average add up; directors: a credit per resolved film.
    for (const p of game.ws.people.values()) {
      const released = p.filmography.filter((f) => f.status !== 'cancelled' && game.ws.movies.get(f.movieId)?.status === 'completed');
      const gross = released.reduce((s, f) => s + game.ws.movies.get(f.movieId)!.boxOffice!.worldwide, 0);
      expect(p.cumulativeGross).toBe(gross);
      expect(p.reviewCount).toBe(released.length);
      if (released.length) expect(p.reviewAvg).toBeCloseTo(released.reduce((s, f) => s + game.ws.movies.get(f.movieId)!.quality!.criticScore, 0) / released.length, 6);
    }
    for (const d of game.ws.directors.values()) {
      const resolved = d.filmIds.filter((id) => game.ws.movies.get(id)?.status === 'completed');
      expect(d.credits.length).toBe(resolved.length);
      for (const c of d.credits) expect(game.ws.movies.get(c.movieId)?.boxOffice?.verdict).toBe(c.verdict);
    }
  });
});
