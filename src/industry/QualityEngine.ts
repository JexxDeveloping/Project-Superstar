/**
 * QualityEngine — the Movie Quality axis (Q, 0–100 hidden → shown as a band).
 *
 * Q is the film, not the player: script, director, ensemble strength, and production luck.
 * The player's *performance roll* never enters Q; the cast's underlying craft does, the way a
 * strong ensemble makes a better film regardless of who had a good week.
 * Q feeds critic score, cult potential and legacy — never star power or salary.
 */
import {
  clamp, type Director, type Genre, type Movie, type Person, type QualityBand, type QualityResult,
  type StatDelta, type WorkingSet,
} from '../core/GameState';
import { rngFor } from '../core/RNG';
import { roleInfluence } from './MovieEngine';
import { GAIN_SCALE } from './PerformanceEngine';

/** How mainstream a genre's audience is — audiences rate crowd-pleasers kinder than critics do. */
const AUDIENCE_TILT: Partial<Record<Genre, number>> = {
  Action: 4, Comedy: 3, Family: 5, Fantasy: 3, 'Science Fiction': 2, Horror: -3, Drama: -2, Historical: -3, Musical: 1, Sports: 3,
};

export function qualityBand(q: number): QualityBand {
  if (q < 35) return 'Poor';
  if (q < 50) return 'Mediocre';
  if (q < 65) return 'Solid';
  if (q < 80) return 'Good';
  if (q < 90) return 'Excellent';
  return 'Masterpiece';
}

export function evaluateQuality(
  worldSeed: number, week: number, movie: Movie, ws: WorkingSet,
): QualityResult {
  const productionQualityMod = movie.productionQualityMod;
  const director = ws.directors.get(movie.directorId) as Director;
  const notes: string[] = [];

  // Ensemble: influence-weighted craft of the cast.
  let wSum = 0;
  let ensemble = 0;
  for (const c of movie.cast) {
    const person = ws.people.get(c.personId);
    if (!person) continue;
    const w = roleInfluence(c.roleType);
    ensemble += person.attributes.acting * w;
    wSum += w;
  }
  ensemble = wSum > 0 ? ensemble / wSum : 50;

  const genreFit = movie.genres.some((g) => director.genreSpecialty.includes(g)) ? 6 : -3;
  const rng = rngFor(worldSeed, movie.id, week, 'quality');
  const production = clamp(50 + productionQualityMod * 2 + genreFit + rng.variance(6), 0, 100);

  const q = clamp(
    0.35 * movie.hidden.scriptQuality + 0.30 * director.overall + 0.20 * ensemble + 0.15 * production,
    0, 100,
  );

  if (movie.hidden.scriptQuality >= 75) notes.push('The screenplay is the film\'s spine.');
  if (movie.hidden.scriptQuality < 45) notes.push('A thin script no one could fully rescue.');
  if (director.overall >= 75) notes.push('Assured direction.');
  if (ensemble >= 65) notes.push('A strong ensemble.');
  if (productionQualityMod >= 4) notes.push('A charmed shoot.');
  if (productionQualityMod <= -4) notes.push('A troubled production shows on screen.');

  // Scores fan out wider than Q itself: critics and crowds amplify — a 60 film reads as a 65 review,
  // a 40 as a 34 — so beloved films reach the 80s and hated ones the 20s (Phase 4: word of mouth,
  // the afterlife rate and legs all key off these).
  const criticScore = clamp(50 + (q - 50) * 1.6 + (director.prestige - 50) / 8 + rng.variance(10), 3, 99);
  const tilt = movie.genres.reduce((s, g) => s + (AUDIENCE_TILT[g] ?? 0), 0) / movie.genres.length;
  const audienceScore = clamp(50 + (0.55 * q + 0.45 * movie.hidden.audienceAppeal - 50) * 2.0 + tilt + rng.variance(10), 5, 99);

  return {
    q: Math.round(q),
    band: qualityBand(q),
    criticScore: Math.round(criticScore),
    audienceScore: Math.round(audienceScore),
    notes,
  };
}

/**
 * Career consequences of Q — being *in* a good (or bad) film, independent of how you were in it.
 * Small, prestige-flavoured, scaled by role size.
 */
export function qualityImpacts(movie: Movie, roleInf: number, quality: QualityResult): StatDelta[] {
  const out: StatDelta[] = [];
  const w = 0.4 + 0.6 * roleInf;
  const base = { Poor: -1.5, Mediocre: -0.5, Solid: 0.3, Good: 1, Excellent: 2, Masterpiece: 3 }[quality.band] * w;
  const prestige = base > 0 ? base * GAIN_SCALE : base;
  if (prestige !== 0) out.push({ target: 'criticalReputation', label: 'Critical Reputation (film quality)', amount: Math.round(prestige * 10) / 10 });
  if (quality.band === 'Excellent' || quality.band === 'Masterpiece') {
    out.push({ target: 'reputation', label: 'Reputation', amount: Math.round(1.5 * w * GAIN_SCALE * 10) / 10 });
  }
  return out;
}

export function applyQualityImpacts(player: Person, deltas: StatDelta[]): void {
  for (const d of deltas) {
    const key = d.target as keyof Person['attributes'];
    if (key in player.attributes) player.attributes[key] = clamp(player.attributes[key] + d.amount, 1, 100);
  }
}
