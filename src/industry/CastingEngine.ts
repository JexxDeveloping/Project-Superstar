/**
 * CastingEngine — who gets seen and who gets the part, for every role in the industry.
 *
 * Player side: callback odds for an application, then the audition-room decision against the
 * role's shortlist. World side: a deterministic shortlist per role (fit by tier, genre, age and
 * gender) and the winner when a movie's casting window closes. Roles nobody fits go to a fresh
 * face, so every film is always fully cast.
 */
import {
  clamp, fullName, type AuditionListing, type BudgetTier, type CompetitorScore, type Director, type GameState,
  type Id, type Movie, type Person, type Role, type Studio, type WorkingSet, markDirty,
} from '../core/GameState';
import { rngFor, type Rng } from '../core/RNG';
import type { EventBus } from '../core/EventBus';
import { ageInYears } from '../sim/ActorEngine';
import { generateActor, takenNames } from '../sim/NPCEngine';
import { attachPerson } from './MovieEngine';
import { VERDICT_RANK } from './BoxOfficeEngine';
import { agentEffects, agentFor } from '../world/AgentEngine';
import { listingVisibility } from './AuditionEngine';

/** Star power the studio "expects" for a role at each budget level. */
export const EXPECTED_STAR: Record<BudgetTier, number> = {
  'Micro Indie': 0, 'Indie': 8, 'Small Studio': 20, 'Medium': 35, 'Large': 45, 'Tentpole': 55,
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** How much a name matters for this film vs. the read itself. */
function starWeight(movie: Movie): number {
  return 0.05 + EXPECTED_STAR[movie.budgetTier] / 200;
}

// ---------------------------------------------------------------------------
// Player: callbacks
// ---------------------------------------------------------------------------

/** The player's recent record as casting sees it: average performance and verdict of the last three films. */
export function trackRecord(player: Person, ws: WorkingSet): { avgPerformance: number | null; avgVerdictRank: number | null; films: number } {
  const recent = player.filmography.slice(-3).filter((f) => f.performance);
  if (recent.length === 0) return { avgPerformance: null, avgVerdictRank: null, films: player.filmography.length };
  const avgPerformance = recent.reduce((s, f) => s + (f.performance?.score ?? 0), 0) / recent.length;
  const verdicts = recent.map((f) => ws.movies.get(f.movieId)?.boxOffice?.verdict).filter((v): v is NonNullable<typeof v> => !!v);
  const avgVerdictRank = verdicts.length ? verdicts.reduce((s, v) => s + VERDICT_RANK[v], 0) / verdicts.length : null;
  return { avgPerformance, avgVerdictRank, films: player.filmography.length };
}

export interface CallbackContext {
  /** Strength of the best NPC on the shortlist relative to the player (fit points; + means they're stronger). */
  competitionGap: number;
  record: ReturnType<typeof trackRecord>;
  agentBonus: number;
}

/**
 * Probability the player is invited to audition (Part 1's full factor list):
 * acting, genre skill, star power vs. tier, previous performances, director & studio relationship,
 * agent, reputation, professionalism, connections, competition, randomness (applied by the caller).
 * Typecasting and perceived-vs-real star power plug in here in Phase 5.
 */
export function callbackProbability(
  player: Person, listing: AuditionListing, movie: Movie, director: Director, studio: Studio, ctx: CallbackContext,
): number {
  const actingGap = player.attributes.acting - listing.requiredActing;
  let p = 0.2 + 0.7 * sigmoid(actingGap / 7); // 0.2–0.9 driven by acting vs. requirement

  const genreSkill = player.genres[listing.preferredGenre];
  p *= 0.8 + 0.4 * sigmoid((genreSkill - 40) / 10); // 0.8–1.2

  const starGap = player.attributes.starPower - EXPECTED_STAR[movie.budgetTier];
  p *= starGap < 0 ? clamp(1 + starGap / 60, 0.45, 1) : 1 + Math.min(0.25, starGap / 200);

  // Track record: rooms remember what you did last time.
  if (ctx.record.avgPerformance !== null) p += (ctx.record.avgPerformance - 2.5) * 0.05;
  if (ctx.record.avgVerdictRank !== null) p += (ctx.record.avgVerdictRank - 2) * 0.03;
  p += clamp(player.momentum / 100, -0.5, 0.5) * 0.1;

  p += (player.attributes.connections / 100) * 0.12;
  p += ((player.attributes.reputation - 50) / 100) * 0.08;
  p += ((player.attributes.professionalism - 50) / 100) * 0.05;
  p += ((director.playerRelationship - 50) / 100) * 0.15;
  p += ((studio.playerRelationship - 50) / 100) * 0.08;
  p += ctx.agentBonus;
  p -= listing.difficulty / 400;
  // Competition: a shortlist that clearly outclasses you closes doors; one you outclass opens them.
  p -= clamp(ctx.competitionGap, -15, 25) * 0.008;

  return clamp(p, 0.05, 0.95);
}

/** The player's fit for a role on the same scale NPCs are shortlisted on. */
export function playerFit(state: GameState, movie: Movie, role: Role): number {
  return roleFit(state.player, role, movie, state.week);
}

export function bestAlternativeFit(worldSeed: number, movie: Movie, role: Role, ws: WorkingSet, week: number): number {
  const list = shortlistFor(worldSeed, movie, role, ws, week, 1);
  return list.length ? roleFit(list[0], role, movie, week) : 0;
}

export function decideCallback(
  state: GameState, listing: AuditionListing, ws: WorkingSet,
): { callback: boolean; probability: number } {
  const player = state.player;
  const movie = ws.movies.get(listing.movieId) as Movie;
  const director = ws.directors.get(movie.directorId) as Director;
  const studio = ws.studios.get(movie.studioId) as Studio;
  const role = movie.roles.find((r) => r.id === listing.roleId) as Role;
  const ctx: CallbackContext = {
    competitionGap: bestAlternativeFit(state.worldSeed, movie, role, ws, state.week) - playerFit(state, movie, role),
    record: trackRecord(player, ws),
    agentBonus: agentEffects(agentFor(state)).callbackBonus,
  };
  const probability = callbackProbability(player, listing, movie, director, studio, ctx);
  const rng = rngFor(state.worldSeed, player.id, state.week, `callback:${listing.id}`);
  return { callback: rng.chance(probability), probability };
}

// ---------------------------------------------------------------------------
// Direct offers — once you're a name, roles come to you
// ---------------------------------------------------------------------------

/** Weekly chance a studio sends a role straight to the player, by star power. */
export function directOfferChance(starPower: number): number {
  if (starPower < 60) return 0;
  return clamp(0.05 + ((starPower - 60) / 30) * 0.3, 0.05, 0.4);
}

/**
 * Find a role in a casting film where the player is the studio's first choice and hand it over
 * without an audition. Returns the movie/role picked, or null.
 */
export function findDirectOffer(state: GameState, ws: WorkingSet): { movie: Movie; role: Role } | null {
  const player = state.player;
  const rng = rngFor(state.worldSeed, player.id, state.week, 'direct-offer');
  const chance = directOfferChance(player.attributes.starPower) * agentEffects(agentFor(state)).directOfferMultiplier;
  if (chance <= 0 || !rng.chance(chance)) return null;
  const busyIds = new Set(state.applications.filter((a) => a.status === 'applied' || a.status === 'audition_pending' || a.status === 'offer' || a.status === 'booked').map((a) => a.movieId));
  // Never offer a part the player has already applied for (that application owns the listing id).
  const appliedRoleIds = new Set(state.applications.map((a) => a.roleId));
  const options: { movie: Movie; role: Role; fit: number }[] = [];
  for (const movie of ws.movies.values()) {
    if (movie.status !== 'casting' || movie.castingCloseWeek <= state.week || busyIds.has(movie.id)) continue;
    if (EXPECTED_STAR[movie.budgetTier] > player.attributes.starPower + 15) continue;
    for (const role of movie.roles) {
      if (role.castPersonId || role.roleType === 'Minor' || role.roleType === 'Extra' || appliedRoleIds.has(role.id)) continue;
      // Studios send names the parts a name would hear about — an Icon isn't offered indie bit work.
      if (listingVisibility(player.attributes.starPower, movie.budgetTier, role.roleType) < 0.2) continue;
      if (role.genderPref !== 'any' && player.gender !== role.genderPref && player.gender !== 'nonbinary') continue;
      const age = ageInYears(player, state.week);
      if (age < role.ageMin - 4 || age > role.ageMax + 4) continue;
      const fit = playerFit(state, movie, role);
      const alt = bestAlternativeFit(state.worldSeed, movie, role, ws, state.week);
      if (fit >= alt - 2) options.push({ movie, role, fit });
    }
  }
  if (options.length === 0) return null;
  options.sort((a, b) => b.fit - a.fit || (a.movie.id < b.movie.id ? -1 : 1));
  const pick = options[Math.min(options.length - 1, rng.int(0, Math.min(2, options.length - 1)))];
  return { movie: pick.movie, role: pick.role };
}

// ---------------------------------------------------------------------------
// World: fit, shortlists, winners
// ---------------------------------------------------------------------------

/** Hard eligibility for a role. */
export function eligibleFor(p: Person, role: Role, movie: Movie, week: number): boolean {
  if (p.status !== 'active') return false;
  // One film at a time, and a breather after the last wrap — longer for names who can afford to wait.
  if (p.activeMovieIds.length >= 1) return false;
  const cooldown = p.attributes.starPower >= 70 ? 10 : p.attributes.starPower >= 40 ? 6 : 2;
  if (week - p.lastWorkedWeek < cooldown) return false;
  if (role.genderPref !== 'any' && p.gender !== role.genderPref && p.gender !== 'nonbinary') return false;
  const age = ageInYears(p, week);
  if (age < role.ageMin - 8 || age > role.ageMax + 8) return false;
  return true;
}

/** Soft fit 0–100: how strongly casting wants this person for this role. */
export function roleFit(p: Person, role: Role, movie: Movie, week: number): number {
  const age = ageInYears(p, week);
  const genreSkill = Math.max(...movie.genres.map((g) => p.genres[g]));
  const sw = starWeight(movie);
  let fit = (0.5 - sw / 2) * p.attributes.acting + 0.25 * genreSkill + sw * p.attributes.starPower + 0.1 * p.attributes.charisma;
  const req = role.requiredActing;
  fit += p.attributes.acting < req ? (p.attributes.acting - req) * 0.8 : Math.min(8, (p.attributes.acting - req) * 0.2);
  // Names don't take bit parts; unknowns don't carry tentpoles.
  const expected = EXPECTED_STAR[movie.budgetTier];
  if (role.roleType === 'Minor' && p.attributes.starPower > expected + 25) fit -= 30;
  // Bigger films chase names for the parts that carry them.
  if (role.roleType === 'Lead' || role.roleType === 'Main Protagonist' || role.roleType === 'Co-Lead') {
    fit += (p.attributes.starPower - expected) * (0.2 + expected / 120);
  }
  // Small films are where fresh faces get their first credits.
  if (expected <= 8 && p.filmography.length < 3) fit += 6;
  if (age < role.ageMin) fit -= (role.ageMin - age) * 2;
  if (age > role.ageMax) fit -= (age - role.ageMax) * 2;
  fit += p.momentum * 0.08;
  return fit;
}

/** Deterministic shortlist of NPC candidates for a role. */
export function shortlistFor(worldSeed: number, movie: Movie, role: Role, ws: WorkingSet, week: number, size = 4): Person[] {
  const rng = rngFor(worldSeed, movie.id, movie.announcedWeek, `shortlist:${role.id}`);
  const scored: { p: Person; s: number }[] = [];
  for (const p of ws.people.values()) {
    if (p.isPlayer || !eligibleFor(p, role, movie, week)) continue;
    scored.push({ p, s: roleFit(p, role, movie, week) + rng.variance(10) });
  }
  scored.sort((a, b) => b.s - a.s || (a.p.id < b.p.id ? -1 : 1));
  return scored.slice(0, size).map((x) => x.p);
}

/** How a candidate reads in the room (same shape as the player's audition score, cheaper inputs). */
export function candidateScore(npc: Person, role: Role, movie: Movie, rng: Rng): number {
  const sw = starWeight(movie);
  const genreSkill = Math.max(...movie.genres.map((g) => npc.genres[g]));
  const base =
    (0.5 - sw / 2) * npc.attributes.acting + 0.3 * genreSkill + 0.1 * npc.attributes.charisma +
    sw * npc.attributes.starPower + (npc.momentum / 100) * 4 + (npc.attributes.professionalism - 50) * 0.05;
  return clamp(base + rng.variance(8), 0, 100);
}

export interface CastingDecision {
  won: boolean;
  competitorScores: CompetitorScore[];
  playerEffective: number;
  reason: string;
}

/** The room decides on the player's audition: clear a floor, then beat the shortlist. */
export function resolveCasting(
  worldSeed: number, week: number, player: Person, playerScore: number, listing: AuditionListing, ws: WorkingSet,
): CastingDecision {
  const movie = ws.movies.get(listing.movieId) as Movie;
  const role = movie.roles.find((r) => r.id === listing.roleId) as Role;
  const rng = rngFor(worldSeed, listing.id, week, 'casting');

  const competitorScores: CompetitorScore[] = listing.competitorIds
    .map((id) => ws.people.get(id))
    .filter((p): p is Person => !!p)
    .map((npc) => ({
      personId: npc.id,
      name: fullName(npc),
      acting: Math.round(npc.attributes.acting),
      starPower: Math.round(npc.attributes.starPower),
      score: Math.round(candidateScore(npc, role, movie, rng)),
    }));

  const sw = starWeight(movie);
  const playerEffective = clamp(playerScore * (1 - sw) + player.attributes.starPower * sw + (player.momentum / 100) * 4, 0, 100);

  const floor = 25 + listing.difficulty / 5;
  if (playerScore < floor) {
    return { won: false, competitorScores, playerEffective, reason: 'Your read did not clear the bar for the role.' };
  }
  const best = competitorScores.reduce((m, c) => (c.score > m ? c.score : m), 0);
  if (playerEffective > best) {
    return { won: true, competitorScores, playerEffective, reason: 'You were the strongest read in the room.' };
  }
  if (best - playerEffective < 4 && rng.chance(0.4)) {
    return { won: true, competitorScores, playerEffective, reason: 'A coin-flip call — the director went with you.' };
  }
  const winner = competitorScores.find((c) => c.score === best);
  return { won: false, competitorScores, playerEffective, reason: `The role went to ${winner?.name ?? 'another actor'}.` };
}

/** Salary a cast member actually gets: the role's base scaled by their name. */
export function castSalary(role: Role, person: Person): number {
  const factor = 0.5 + (person.attributes.starPower / 100) * 1.5;
  const raw = role.salary * factor;
  const step = raw >= 100_000 ? 10_000 : raw >= 10_000 ? 500 : 100;
  return Math.max(step, Math.round(raw / step) * step);
}

/** Fill one role from its shortlist (or a fresh face). Returns the person cast. */
export function castRole(state: GameState, movie: Movie, role: Role, ws: WorkingSet): Person {
  const { worldSeed, week, universeId } = state;
  const rng = rngFor(worldSeed, movie.id, week, `cast:${role.id}`);
  const shortlist = shortlistFor(worldSeed, movie, role, ws, week);
  let winner: Person | undefined;
  if (shortlist.length > 0) {
    const scored = shortlist.map((p) => ({ p, s: candidateScore(p, role, movie, rng) }));
    scored.sort((a, b) => b.s - a.s);
    winner = scored[0].p;
  } else {
    state.genCounter += 1;
    const id = `p-${week}-${state.genCounter}`;
    winner = generateActor(universeId, worldSeed, week, id, 'unknown', takenNames(ws), {
      gender: role.genderPref === 'any' ? undefined : role.genderPref,
      ageYears: clamp(rng.int(role.ageMin, role.ageMax), 18, 70),
    });
    ws.people.set(id, winner);
  }
  attachPerson(ws, movie, winner, role, castSalary(role, winner));
  return winner;
}

/**
 * Close a movie's casting window: fill every open role, except one the player is still in the
 * running for (unless `force`). Moves the film to pre-production once fully cast.
 */
export function closeCasting(state: GameState, movie: Movie, ws: WorkingSet, bus: EventBus, force: boolean): void {
  const held = new Set<Id>();
  if (!force) {
    for (const app of state.applications) {
      if (app.movieId !== movie.id) continue;
      if (app.status === 'applied' || app.status === 'audition_pending' || app.status === 'offer') held.add(app.roleId);
    }
  }
  for (const role of movie.roles) {
    if (role.castPersonId || held.has(role.id)) continue;
    castRole(state, movie, role, ws);
  }
  if (movie.roles.every((r) => r.castPersonId)) {
    movie.status = 'pre-production';
    const lead = movie.cast.find((c) => c.billing === 1);
    const leadPerson = lead ? ws.people.get(lead.personId) : undefined;
    if (movie.budget >= 40_000_000 && leadPerson) {
      bus.emit('industry', `${fullName(leadPerson)} to star in ${movie.title}`, `${ws.studios.get(movie.studioId)?.name} locks its cast; cameras roll in ${Math.max(0, movie.productionStartWeek - state.week)} weeks.`);
    }
  }
  markDirty(ws, 'movies', movie.id);
}

/** The player couldn't make the shoot: drop them from the film and recast the part. */
export function replacePlayer(state: GameState, movie: Movie, ws: WorkingSet, bus: EventBus): void {
  const player = state.player;
  const role = movie.roles.find((r) => r.castPersonId === player.id);
  movie.cast = movie.cast.filter((c) => c.personId !== player.id);
  player.activeMovieIds = player.activeMovieIds.filter((id) => id !== movie.id);
  state.trackedMovieIds = state.trackedMovieIds.filter((id) => id !== movie.id);
  for (const app of state.applications) {
    if (app.movieId === movie.id && (app.status === 'booked' || app.status === 'offer')) app.status = 'expired';
  }
  let replacement: Person | undefined;
  if (role) {
    role.castPersonId = undefined;
    replacement = castRole(state, movie, role, ws);
  }
  markDirty(ws, 'movies', movie.id);
  markDirty(ws, 'people', player.id);
  bus.emit('casting', `Replaced on ${movie.title}`, `The production couldn't wait any longer${replacement ? ` — ${fullName(replacement)} takes the part` : ''}. Your other shoot came first.`);
}
