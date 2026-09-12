import { describe, expect, it } from 'vitest';
import { Rng, rngFor, seedFromString } from '../core/RNG';

describe('RNG — context-derived seeds', () => {
  it('replays identically for the same context', () => {
    const a = rngFor(123, 'movie-1', 40, 'bo-opening');
    const b = rngFor(123, 'movie-1', 40, 'bo-opening');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs when any context part changes', () => {
    const base = rngFor(123, 'movie-1', 40, 'bo-opening').next();
    expect(rngFor(124, 'movie-1', 40, 'bo-opening').next()).not.toBe(base);
    expect(rngFor(123, 'movie-2', 40, 'bo-opening').next()).not.toBe(base);
    expect(rngFor(123, 'movie-1', 41, 'bo-opening').next()).not.toBe(base);
    expect(rngFor(123, 'movie-1', 40, 'bo-week').next()).not.toBe(base);
  });

  it('is order-independent: drawing for A then B equals drawing for B then A', () => {
    const a1 = rngFor(7, 'a', 1, 'x').next();
    const b1 = rngFor(7, 'b', 1, 'x').next();
    const b2 = rngFor(7, 'b', 1, 'x').next();
    const a2 = rngFor(7, 'a', 1, 'x').next();
    expect(a1).toBe(a2);
    expect(b1).toBe(b2);
  });

  it('produces uniform-ish values in [0,1) and bounded variance', () => {
    const rng = new Rng(seedFromString('uniform'));
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / n).toBeGreaterThan(0.48);
    expect(sum / n).toBeLessThan(0.52);

    const v = new Rng(42);
    for (let i = 0; i < 5000; i++) {
      const x = v.variance(7);
      expect(Math.abs(x)).toBeLessThanOrEqual(7);
    }
  });

  it('int/pick/weighted stay inside their domains', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const k = rng.int(3, 5);
      expect(k).toBeGreaterThanOrEqual(3);
      expect(k).toBeLessThanOrEqual(5);
    }
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) expect(items).toContain(rng.pick(items));
    const w = [{ item: 'never', weight: 0 }, { item: 'always', weight: 1 }];
    for (let i = 0; i < 100; i++) expect(rng.weighted(w)).toBe('always');
  });
});
