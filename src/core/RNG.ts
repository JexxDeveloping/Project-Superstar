/**
 * Seeded randomness with context-derived seeds.
 *
 * Every roll in the game comes from an `Rng` created via `rngFor(worldSeed, entityId, week, eventId)`.
 * The four parts are hashed into a 32-bit seed that drives a mulberry32 stream, so any outcome is
 * reproducible regardless of the order engines run in, what is paged in from the DB, or whether the
 * tick runs in a Worker. The global unseeded random function must never be used anywhere in src/.
 */

/** xmur3 string hash → 32-bit seed. */
function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32: small, fast, good-enough PRNG for game sims. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly nextRaw: () => number;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.nextRaw = mulberry32(this.seed);
  }

  /** Uniform in [0, 1). */
  next(): number {
    return this.nextRaw();
  }

  /** Uniform float in [min, max). */
  float(min: number, max: number): number {
    return min + (max - min) * this.nextRaw();
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.nextRaw() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.nextRaw() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick on empty array');
    return arr[Math.floor(this.nextRaw() * arr.length)];
  }

  /** Weighted pick; weights need not sum to 1. */
  weighted<T>(items: readonly { item: T; weight: number }[]): T {
    let total = 0;
    for (const it of items) total += Math.max(0, it.weight);
    let r = this.nextRaw() * total;
    for (const it of items) {
      r -= Math.max(0, it.weight);
      if (r < 0) return it.item;
    }
    return items[items.length - 1].item;
  }

  /**
   * Bounded, bell-shaped variance in [-spread, +spread].
   * Sum of three uniforms (Bates) — most results cluster near 0, extremes are rare but possible.
   * Used for "controlled randomness": it widens the band, it never overrides fundamentals.
   */
  variance(spread: number): number {
    const u = (this.nextRaw() + this.nextRaw() + this.nextRaw()) / 3; // mean 0.5, in [0,1]
    return (u - 0.5) * 2 * spread;
  }

  /** Multiplicative variance centred on 1, e.g. spread 0.25 → roughly [0.75, 1.25]. */
  multiplier(spread: number): number {
    return 1 + this.variance(spread);
  }

  /** Fisher–Yates shuffle (returns a new array). */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.nextRaw() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

/**
 * Create an Rng whose seed is derived from stable context.
 * Same inputs → same stream, every time, in any call order.
 */
export function rngFor(worldSeed: number, entityId: string, week: number, eventId: string): Rng {
  return new Rng(hashString(`${worldSeed >>> 0}|${entityId}|${week}|${eventId}`));
}

/** Derive a numeric world seed from a human-readable seed string. */
export function seedFromString(s: string): number {
  return hashString(s);
}
