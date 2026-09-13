/**
 * StudioEngine — studios as slates: each greenlights films toward an annual target in its own
 * identity, and its reputation drifts with results.
 */
import { clamp, sortedById, type GameState, type Movie, type Studio, type WorkingSet, markDirty } from '../core/GameState';
import { rngFor } from '../core/RNG';
import type { EventBus } from '../core/EventBus';
import { WEEKS_PER_YEAR } from '../sim/ActorEngine';
import { chooseDirector, generateMovie, pickTierAndGenres } from '../gen/MovieGen';
import { VERDICT_RANK } from '../industry/BoxOfficeEngine';

/** Title set per working set, rebuilt only when films appeared outside the greenlight pass (e.g. a load). */
const TITLE_CACHE = new WeakMap<WorkingSet, { count: number; titles: Set<string> }>();

export function takenTitles(ws: WorkingSet): Set<string> {
  const cached = TITLE_CACHE.get(ws);
  if (cached && cached.count === ws.movies.size) return cached.titles;
  const titles = new Set<string>();
  for (const m of ws.movies.values()) titles.add(m.title.toLowerCase());
  TITLE_CACHE.set(ws, { count: ws.movies.size, titles });
  return titles;
}

function noteTitle(ws: WorkingSet, title: string): void {
  const cached = TITLE_CACHE.get(ws);
  if (cached) { cached.titles.add(title.toLowerCase()); cached.count = ws.movies.size; }
}

/**
 * Weekly greenlight pass. Each studio's chance this week is set so it lands near its yearly
 * target, catching up when behind and easing off when ahead. Returns the new movies.
 */
export function greenlightSlates(state: GameState, ws: WorkingSet, bus: EventBus): Movie[] {
  const { week, worldSeed, universeId } = state;
  const out: Movie[] = [];
  const titles = takenTitles(ws);
  const directors = sortedById(ws.directors.values());
  const weekOfYear = ((week % WEEKS_PER_YEAR) + WEEKS_PER_YEAR) % WEEKS_PER_YEAR; // prehistory weeks are negative

  for (const studio of sortedById(ws.studios.values())) {
    if (weekOfYear === 0) studio.greenlitThisYear = 0;
    const expectedByNow = (studio.slateTarget * (weekOfYear + 1)) / WEEKS_PER_YEAR;
    const behind = expectedByNow - studio.greenlitThisYear; // >0 behind schedule
    const weeklyBase = studio.slateTarget / WEEKS_PER_YEAR;
    const p = clamp(weeklyBase * (1 + behind * 0.8), 0.02, 0.6);
    const rng = rngFor(worldSeed, studio.id, week, 'greenlight');
    if (!rng.chance(p)) continue;

    const picked = pickTierAndGenres(rngFor(worldSeed, studio.id, week, 'slate-pick'), studio, state.genreTrends);
    const director = chooseDirector(rngFor(worldSeed, studio.id, week, 'director-pick'), picked.genres, picked.tier, directors);
    if (!director) continue; // everyone is busy; try next week

    state.genCounter += 1;
    const movie = generateMovie({
      universeId, worldSeed, week, counter: state.genCounter, studio, director, takenTitles: titles, tier: picked.tier, genres: picked.genres, trends: state.genreTrends,
    });
    ws.movies.set(movie.id, movie);
    noteTitle(ws, movie.title);
    markDirty(ws, 'movies', movie.id);
    director.activeMovieId = movie.id;
    markDirty(ws, 'directors', director.id);
    studio.greenlitThisYear += 1;
    markDirty(ws, 'studios', studio.id);
    out.push(movie);

    if (movie.budget >= 40_000_000) {
      bus.emit('industry', `${studio.name} greenlights ${movie.title}`, `${movie.genres.join('/')} · $${(movie.budget / 1e6).toFixed(0)}M · directed by ${director.firstName} ${director.lastName}. Casting now.`);
    }
  }
  return out;
}

/** Reputation follows results: prestige studios care about critics, the rest about verdicts. */
export function recordStudioResult(ws: WorkingSet, movie: Movie, playerTrustDelta = 0, playerInCast = false): void {
  const s = ws.studios.get(movie.studioId);
  if (!s || !movie.boxOffice?.verdict || !movie.quality) return;
  s.filmLog.push({
    movieId: movie.id, week: movie.boxOffice.weeks[movie.boxOffice.weeks.length - 1].week, verdict: movie.boxOffice.verdict,
    worldwide: movie.boxOffice.worldwide, budget: movie.budget, playerInCast, playerTrustDelta,
  });
  const rank = VERDICT_RANK[movie.boxOffice.verdict];
  const commercial = 26 + rank * 12; // Average → 50
  const target = s.identity === 'prestige' ? movie.quality.criticScore * 0.6 + commercial * 0.4 : commercial * 0.7 + movie.quality.criticScore * 0.3;
  s.reputation = clamp(s.reputation * 0.92 + target * 0.08, 5, 100);
  markDirty(ws, 'studios', s.id);
}

export function studioSummary(s: Studio): string {
  return `${s.name} — ${s.description} (rep ${Math.round(s.reputation)})`;
}
