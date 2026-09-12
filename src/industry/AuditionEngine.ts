/**
 * AuditionEngine — the audition board and the audition event itself.
 *
 * Listings are real roles in movies currently casting, filtered by what an actor of the player's
 * standing would actually hear about (Part 1: Movie Offer Logic). The competition on a listing is
 * the role's genuine shortlist. Whether the player gets a callback or wins the role is
 * CastingEngine's call; the orchestrator (TimeEngine) wires the two through shared state.
 */
import {
  clamp, type Application, type AuditionListing, type BudgetTier, type Director, type EstimateBand, type GameState,
  type Id, type Movie, type PrepChoice, type Role, type RoleType, type WorkingSet,
} from '../core/GameState';
import { rngFor, type Rng } from '../core/RNG';
import type { EventBus } from '../core/EventBus';
import { ageInYears } from '../sim/ActorEngine';
import { shortlistFor } from './CastingEngine';

export const OFFER_WINDOW_WEEKS = 2;
export const MAX_OPEN_LISTINGS = 7;
export const MAX_NEW_LISTINGS_PER_WEEK = 3;

export interface PrepEffect { score: number; cash: number; energy: number; stress: number; carry: number; blurb: string }

/** Prep options before the audition (Part 1: Audition Event). Each costs time/money/energy. */
export const PREP_EFFECTS: Record<PrepChoice, PrepEffect> = {
  'Study Character': { score: 6, cash: 0, energy: 10, stress: 2, carry: 2, blurb: 'Deep character work; carries into the shoot.' },
  'Practice Scene': { score: 7, cash: 0, energy: 12, stress: 3, carry: 1, blurb: 'Run the sides until they are second nature.' },
  'Work With Acting Coach': { score: 9, cash: 300, energy: 8, stress: 1, carry: 1, blurb: 'Costs $300. The biggest single boost.' },
  'Research Genre': { score: 5, cash: 0, energy: 8, stress: 1, carry: 1, blurb: 'Stronger if the genre is unfamiliar to you.' },
  'Physical Preparation': { score: 4, cash: 0, energy: 15, stress: 2, carry: 1, blurb: 'Big for Action and Sports roles.' },
  'Do Nothing': { score: 0, cash: 0, energy: 0, stress: 0, carry: 0, blurb: 'Save energy, go in cold.' },
};

/** Hidden 0–100 → fuzzy band the player sees. Fuzz shrinks with better information (Phase 5). */
export function estimateBand(value: number, rng: Rng, fuzz = 12): EstimateBand {
  const v = value + rng.variance(fuzz);
  if (v < 20) return 'Very Low';
  if (v < 33) return 'Low';
  if (v < 45) return 'Low–Moderate';
  if (v < 58) return 'Moderate';
  if (v < 70) return 'Moderate–High';
  if (v < 84) return 'High';
  return 'Very High';
}

// ---------------------------------------------------------------------------
// Which roles an actor of this standing hears about (Part 1: Movie Offer Logic)
// ---------------------------------------------------------------------------

const TIER_ORDER: BudgetTier[] = ['Micro Indie', 'Indie', 'Small Studio', 'Medium', 'Large', 'Tentpole'];
const ROLE_SIZE: Record<RoleType, number> = { 'Extra': 0, 'Minor': 1, 'Supporting': 2, 'Co-Lead': 3, 'Lead': 4, 'Main Protagonist': 5 };

/** Probability a listing for this role surfaces for the player, by star power. */
export function listingVisibility(starPower: number, tier: BudgetTier, roleType: RoleType): number {
  const t = TIER_ORDER.indexOf(tier); // 0..5
  const r = ROLE_SIZE[roleType]; // 0..5
  if (starPower < 40) {
    if (t <= 1) return 1;
    if (t === 2) return r <= 2 ? 0.35 : 0.05;
    return r <= 1 ? 0.1 : 0;
  }
  if (starPower < 60) {
    if (t <= 2) return 1;
    if (t === 3) return r <= 2 ? 0.7 : 0.15;
    return r <= 1 ? 0.25 : 0.03;
  }
  if (starPower < 80) {
    if (t <= 1) return r >= 3 ? 0.6 : 0.15; // still hears about indie leads
    if (t <= 3) return 1;
    return r >= 2 && r <= 3 ? 0.7 : r <= 1 ? 0.3 : 0.12;
  }
  if (starPower < 90) {
    if (t <= 1) return r >= 3 ? 0.4 : 0.05;
    if (t === 2) return r >= 2 ? 0.6 : 0.1;
    if (t === 3) return r >= 2 ? 1 : 0.2;
    return r >= 2 ? 1 : 0.1;
  }
  return r >= 2 ? 1 : 0.05; // superstars: every real part, no bit parts
}

function fitsPlayer(state: GameState, role: Role): boolean {
  const p = state.player;
  if (role.genderPref !== 'any' && p.gender !== role.genderPref && p.gender !== 'nonbinary') return false;
  const age = ageInYears(p, state.week);
  return age >= role.ageMin - 4 && age <= role.ageMax + 4;
}

// ---------------------------------------------------------------------------
// Board maintenance
// ---------------------------------------------------------------------------

const IN_FLIGHT = new Set<Application['status']>(['applied', 'audition_pending', 'offer', 'booked']);

/**
 * Weekly board pass: drop listings whose role is gone (cast, or casting closed), lapse ignored
 * offers, then surface new roles from movies currently casting.
 */
export function refreshListings(state: GameState, ws: WorkingSet, bus: EventBus): void {
  const week = state.week;
  const player = state.player;

  // Expire.
  const stillOpen: AuditionListing[] = [];
  for (const l of state.listings) {
    const movie = ws.movies.get(l.movieId);
    const role = movie?.roles.find((r) => r.id === l.roleId);
    const app = state.applications.find((a) => a.listingId === l.id);
    const roleGone = !movie || !role || (role.castPersonId !== undefined && role.castPersonId !== player.id);
    if (roleGone) {
      if (app && app.status !== 'booked' && app.status !== 'in_production' && IN_FLIGHT.has(app.status)) {
        app.status = 'expired';
        bus.emit('audition', `Casting closed: ${l.characterName}`, `${movie?.title ?? 'The film'} cast the part elsewhere.`);
      }
      continue;
    }
    if (l.expiresWeek <= week && (!app || !IN_FLIGHT.has(app.status))) {
      continue;
    }
    if (app && (app.status === 'booked' || app.status === 'in_production') && movie.status !== 'casting') continue;
    stillOpen.push(l);
  }
  state.listings = stillOpen;

  // Offers lapse if ignored.
  for (const app of state.applications) {
    if (app.status === 'offer' && app.offerExpiresWeek !== undefined && app.offerExpiresWeek <= week) {
      app.status = 'expired';
      bus.emit('casting', 'Offer withdrawn', `The ${app.characterName} offer lapsed without an answer.`);
    }
  }

  // Post new roles.
  const listedRoleIds = new Set(state.listings.map((l) => l.roleId));
  const appliedRoleIds = new Set(state.applications.map((a) => a.roleId));
  let posted = 0;
  const candidates = [...ws.movies.values()]
    .filter((m) => m.status === 'casting' && m.castingCloseWeek > week)
    .sort((a, b) => a.announcedWeek - b.announcedWeek || (a.id < b.id ? -1 : 1));
  for (const movie of candidates) {
    if (state.listings.length >= MAX_OPEN_LISTINGS || posted >= MAX_NEW_LISTINGS_PER_WEEK) break;
    for (const role of movie.roles) {
      if (role.castPersonId || listedRoleIds.has(role.id) || appliedRoleIds.has(role.id)) continue;
      if (!fitsPlayer(state, role)) continue;
      const rng = rngFor(state.worldSeed, movie.id, movie.announcedWeek, `listing:${role.id}`);
      if (!rng.chance(listingVisibility(player.attributes.starPower, movie.budgetTier, role.roleType))) continue;
      const director = ws.directors.get(movie.directorId) as Director;
      const listing: AuditionListing = {
        id: `l-${role.id}`,
        movieId: movie.id,
        roleId: role.id,
        characterName: role.characterName,
        roleType: role.roleType,
        expectedSalary: Math.max(100, Math.round(role.salary * (0.5 + (player.attributes.starPower / 100) * 1.5) / 100) * 100),
        difficulty: role.difficulty,
        requiredActing: role.requiredActing,
        preferredGenre: movie.genres[0],
        estimatedPrestige: estimateBand(movie.hidden.scriptQuality * 0.7 + director.prestige * 0.3, rng),
        estimatedCommercial: estimateBand(movie.hidden.commercialPotential, rng),
        competitorIds: shortlistFor(state.worldSeed, movie, role, ws, week).map((p) => p.id),
        postedWeek: week,
        expiresWeek: movie.castingCloseWeek,
      };
      state.listings.push(listing);
      listedRoleIds.add(role.id);
      posted += 1;
      bus.emit('audition', 'New casting call', `${role.roleType} role "${role.characterName}" in ${movie.title} is open.`);
      if (state.listings.length >= MAX_OPEN_LISTINGS || posted >= MAX_NEW_LISTINGS_PER_WEEK) break;
    }
  }
}

export function findListing(state: GameState, listingId: Id): AuditionListing | undefined {
  return state.listings.find((l) => l.id === listingId);
}

export function findApplication(state: GameState, listingId: Id): Application | undefined {
  return state.applications.find((a) => a.listingId === listingId);
}

/** Can the player apply right now? Returns a reason string when not. */
export function applyBlockedReason(state: GameState, listingId: Id): string | null {
  const listing = findListing(state, listingId);
  if (!listing) return 'Listing is no longer open.';
  if (findApplication(state, listingId)) return 'Already applied.';
  if (state.weekPlan.some((a) => a.type === 'apply' && a.listingId === listingId)) return 'Application already planned this week.';
  if (state.activeProduction) return 'You are on set — finish filming first.';
  if (state.applications.some((a) => a.status === 'booked')) return 'You already have a booked role waiting to shoot.';
  return null;
}

/** Turn this week's planned `apply` actions into live applications. */
export function resolveApplications(state: GameState, ws: WorkingSet, bus: EventBus): void {
  for (const action of state.weekPlan) {
    if (action.type !== 'apply') continue;
    const listing = findListing(state, action.listingId);
    if (!listing || findApplication(state, action.listingId)) continue;
    state.applications.push({
      listingId: listing.id,
      movieId: listing.movieId,
      roleId: listing.roleId,
      movieTitle: ws.movies.get(listing.movieId)?.title ?? 'Untitled',
      characterName: listing.characterName,
      roleType: listing.roleType,
      appliedWeek: state.week - 1, // planned last week, submitted as this week opens
      status: 'applied',
    });
    bus.emit('audition', `Applied: ${listing.characterName}`, 'Your reel and headshot are in. Casting responds next week.');
  }
}

export function setPrep(state: GameState, listingId: Id, prep: PrepChoice): void {
  const app = findApplication(state, listingId);
  if (!app || app.status !== 'audition_pending') throw new Error('No audition pending for that listing.');
  app.prep = prep;
}

// ---------------------------------------------------------------------------
// The audition itself
// ---------------------------------------------------------------------------

export interface AuditionOutcome { score: number; reaction: string; carry: number }

/** Score the player's audition for a listing. Applies prep costs. */
export function performAudition(
  state: GameState, ws: WorkingSet, app: Application, listing: AuditionListing, bus: EventBus,
): AuditionOutcome {
  const p = state.player;
  const movie = ws.movies.get(listing.movieId) as Movie;
  const director = ws.directors.get(movie.directorId) as Director;
  const rng = rngFor(state.worldSeed, p.id, state.week, `audition:${listing.id}`);

  const prep = app.prep ?? 'Do Nothing';
  const effect = PREP_EFFECTS[prep];
  p.cash -= effect.cash;
  p.energy = clamp(p.energy - effect.energy, 0, 100);
  p.stress = clamp(p.stress + effect.stress, 0, 100);

  const genreSkill = p.genres[listing.preferredGenre];
  let prepScore = effect.score;
  if (prep === 'Research Genre' && genreSkill < 40) prepScore = 8;
  if (prep === 'Physical Preparation' && (listing.preferredGenre === 'Action' || listing.preferredGenre === 'Sports')) prepScore = 9;

  const fundamentals = 0.45 * p.attributes.acting + 0.30 * genreSkill + 0.10 * p.attributes.charisma + 0.05 * p.attributes.professionalism;
  const energyPenalty = p.energy < 40 ? (40 - p.energy) / 2 : 0;
  const stressPenalty = p.stress > 60 ? (p.stress - 60) / 3 : 0;
  const relationship = (director.playerRelationship - 50) / 10;
  const variance = rng.variance(8);

  const score = clamp(fundamentals + prepScore + relationship - energyPenalty - stressPenalty + variance, 0, 100);

  const reaction = directorReaction(score, {
    genreWeak: genreSkill < listing.requiredActing - 5,
    tired: energyPenalty + stressPenalty > 5,
    prepped: prepScore >= 6,
    genre: listing.preferredGenre,
    starGap: p.attributes.starPower < 20 && movie.budget >= 10_000_000,
  }, rng);

  app.auditionScore = Math.round(score);
  app.directorReaction = reaction;
  bus.emit('audition', `Audition: ${listing.characterName}`, `Score ${Math.round(score)}/100 — "${reaction}"`);
  return { score, reaction, carry: effect.carry };
}

function directorReaction(
  score: number,
  ctx: { genreWeak: boolean; tired: boolean; prepped: boolean; genre: string; starGap: boolean },
  rng: { pick<T>(a: readonly T[]): T },
): string {
  const notes: string[] = [];
  if (score >= 80) notes.push(rng.pick(['Commanding read — the room went quiet.', 'Exactly the energy on the page, and then some.', 'That was the take we have been waiting for all day.']));
  else if (score >= 65) notes.push(rng.pick(['Strong emotional delivery.', 'Confident, well-prepared, hit the beats.', 'Good instincts; the director leaned in.']));
  else if (score >= 50) notes.push(rng.pick(['Solid but unremarkable.', 'Competent read; nothing that jumped out.', 'Hit the lines, missed the moment.']));
  else if (score >= 35) notes.push(rng.pick(['Nerves showed. The second pass was better.', 'Underpowered — the character never arrived.', 'The room was polite. That is not a good sign.']));
  else notes.push(rng.pick(['Rough. Lines dropped, energy flat.', 'Not ready for this one.', 'A hard no in the room.']));

  if (ctx.genreWeak) notes.push(`There are concerns about your ${ctx.genre.toLowerCase()} experience.`);
  if (ctx.tired) notes.push('You looked exhausted, and it read on camera.');
  if (ctx.prepped && score >= 50) notes.push('The preparation was obvious and appreciated.');
  if (ctx.starGap) notes.push('The studio would prefer a name they can market.');
  return notes.join(' ');
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export function acceptOffer(state: GameState, listingId: Id): { app: Application; listing: AuditionListing } {
  const app = findApplication(state, listingId);
  const listing = findListing(state, listingId);
  if (!app || !listing || app.status !== 'offer') throw new Error('No live offer for that listing.');
  app.status = 'booked';
  return { app, listing };
}

export function declineOffer(state: GameState, listingId: Id): void {
  const app = findApplication(state, listingId);
  if (!app || app.status !== 'offer') throw new Error('No live offer for that listing.');
  app.status = 'declined';
}
