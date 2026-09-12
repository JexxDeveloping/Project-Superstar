/**
 * TrendEngine — genre popularity that drifts over the years (Part 1 "industry trends").
 *
 * Each genre carries a popularity multiplier around 1.0 that random-walks once a year with mild
 * mean reversion, seeded on the world and the year: a superhero decade, a horror revival, comedy
 * falling out of fashion. It feeds the opening model's genre factor and studio slate choices.
 * Phase 5 hangs news on the swings.
 */
import { GENRES, clamp, type GameState, type Genre } from '../core/GameState';
import { rngFor } from '../core/RNG';
import { WEEKS_PER_YEAR } from '../sim/ActorEngine';

export const TREND_MIN = 0.7;
export const TREND_MAX = 1.35;

export function initGenreTrends(worldSeed: number): Record<Genre, number> {
  const rng = rngFor(worldSeed, 'trends', 0, 'init');
  const out = {} as Record<Genre, number>;
  for (const g of GENRES) out[g] = clamp(1 + rng.variance(0.12), TREND_MIN, TREND_MAX);
  return out;
}

/** Yearly step: a bounded random walk pulled gently back toward 1. Call on the first week of each year. */
export function tickGenreTrends(state: GameState): void {
  if (((state.week % WEEKS_PER_YEAR) + WEEKS_PER_YEAR) % WEEKS_PER_YEAR !== 0) return;
  const rng = rngFor(state.worldSeed, 'trends', state.week, 'walk');
  for (const g of GENRES) {
    const t = state.genreTrends[g] ?? 1;
    state.genreTrends[g] = clamp(t + rng.variance(0.09) + (1 - t) * 0.12, TREND_MIN, TREND_MAX);
  }
}

export function trendLabel(t: number): string {
  if (t >= 1.2) return 'hot';
  if (t >= 1.08) return 'rising';
  if (t <= 0.8) return 'out of fashion';
  if (t <= 0.92) return 'cooling';
  return 'steady';
}
