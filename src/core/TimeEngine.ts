/**
 * TimeEngine — 1 turn = 1 week. Owns the calendar and runs the ordered, synchronous weekly tick.
 *
 * Engines never call each other; this is the one place that sequences them over shared state.
 * There is no `await` anywhere in `advanceWeek`: the working set is loaded before, deltas are
 * persisted after (by Game/SaveEngine). With `worldOnly` the player's sections are skipped —
 * used for the year of prehistory before a career starts.
 */
import {
  TIMELINE_CAP, fullName, type GameState, type Movie, type MovieResult, type PerformanceResult, type QualityResult,
  type StatDelta, type TimelineEvent, type Verdict, type WorkingSet, markDirty,
} from './GameState';
import { EventBus } from './EventBus';
import { ageInYears, resolvePlayerWeek, starTier, WEEKS_PER_YEAR } from '../sim/ActorEngine';
import { npcWeeklyDrift } from '../sim/NPCEngine';
import { tickCareers } from '../sim/CareerEngine';
import { OFFER_WINDOW_WEEKS, estimateBand, findListing, performAudition, refreshListings, resolveApplications, resolveScriptReads } from '../industry/AuditionEngine';
import { bestAlternativeFit, closeCasting, decideCallback, findDirectOffer, playerFit, replacePlayer, resolveCasting, shortlistFor } from '../industry/CastingEngine';
import { MAX_HOLD_WEEKS, completeMovie, hasPlayer, roleInfluence, tickCancellations, tickMovies, wrapMovie } from '../industry/MovieEngine';
import { computePayout, generateOffer } from '../industry/ContractEngine';
import { agentFor, tickAgentApproaches } from '../world/AgentEngine';
import { rngFor } from './RNG';
import { startProduction, tickProduction } from '../industry/ProductionEngine';
import {
  applyPerformanceImpacts, evaluatePerformance, npcPerformanceContext, performanceImpacts, type PerformanceContext,
} from '../industry/PerformanceEngine';
import { applyQualityImpacts, evaluateQuality, qualityImpacts } from '../industry/QualityEngine';
import {
  applyCommercialImpacts, commercialImpacts, formatMoney, openRun, tickRun, weekOverWeek,
} from '../industry/BoxOfficeEngine';
import { greenlightSlates, recordStudioResult } from '../world/StudioEngine';
import { recordDirectorResult } from '../world/DirectorEngine';

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** 4-4-5 quarters → 52 weeks a year, every year. */
const WEEKS_IN_MONTH = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5];

export interface GameDate {
  year: number;
  month: number; // 0-based
  monthName: string;
  weekOfMonth: number; // 1-based
  weekOfYear: number; // 0-based
}

export function dateForWeek(week: number, epochYear: number): GameDate {
  const year = epochYear + Math.floor(week / WEEKS_PER_YEAR);
  let weekOfYear = week % WEEKS_PER_YEAR;
  if (weekOfYear < 0) weekOfYear += WEEKS_PER_YEAR;
  let remaining = weekOfYear;
  let month = 0;
  while (remaining >= WEEKS_IN_MONTH[month]) {
    remaining -= WEEKS_IN_MONTH[month];
    month += 1;
  }
  return { year, month, monthName: MONTH_NAMES[month], weekOfMonth: remaining + 1, weekOfYear };
}

export function formatDate(week: number, epochYear: number): string {
  const d = dateForWeek(week, epochYear);
  return `${d.monthName} ${d.year} — Week ${d.weekOfMonth}`;
}

// ---------------------------------------------------------------------------
// The weekly tick
// ---------------------------------------------------------------------------

export interface TickOptions { worldOnly?: boolean }

export function advanceWeek(state: GameState, ws: WorkingSet, opts: TickOptions = {}): TimelineEvent[] {
  state.week += 1;
  const week = state.week;
  const bus = new EventBus(week);
  const player = state.player;
  const worldOnly = opts.worldOnly === true;

  // 1. The player's week: actions, drift, expenses, applications, auditions, callbacks.
  if (!worldOnly) {
    if ((week - player.birthWeek) % WEEKS_PER_YEAR === 0) {
      bus.emit('time', `Happy birthday — ${ageInYears(player, week)}`, 'Another year in the business.');
    }
    resolvePlayerWeek(state, bus);
    resolveScriptReads(state, ws, bus);
    resolveApplications(state, ws, bus);
    const agent = agentFor(state);
    const careerGross = player.filmography.reduce((sum, f) => sum + (ws.movies.get(f.movieId)?.boxOffice?.worldwide ?? 0), 0);
    for (const app of state.applications) {
      if (app.status !== 'audition_pending' || app.auditionWeek !== week) continue;
      const listing = findListing(state, app.listingId);
      if (!listing) { app.status = 'expired'; continue; }
      const outcome = performAudition(state, ws, app, listing, bus);
      const decision = resolveCasting(state.worldSeed, week, player, outcome.score, listing, ws);
      app.competitorScores = decision.competitorScores;
      // Head-to-head: every named competitor you were scored against, and who read better.
      for (const c of decision.competitorScores) {
        player.headToHead.push({ personId: c.personId, week, movieId: listing.movieId, roleType: listing.roleType, won: decision.playerEffective > c.score });
      }
      const movie = ws.movies.get(listing.movieId);
      const role = movie?.roles.find((r) => r.id === listing.roleId);
      if (decision.won && movie && role) {
        app.status = 'offer';
        app.offerExpiresWeek = week + OFFER_WINDOW_WEEKS;
        app.prepBonus = outcome.carry;
        app.contract = generateOffer(state, ws, movie, role, {
          direct: false, agent, careerGross,
          playerFit: playerFit(state, movie, role), bestAlternativeFit: bestAlternativeFit(state.worldSeed, movie, role, ws, week),
        });
        bus.emit('casting', `Offer: ${listing.characterName}`, `${decision.reason} ${ws.studios.get(movie.studioId)?.name} opens at $${app.contract.terms.baseSalary.toLocaleString()} for ${listing.roleType}. Negotiate or sign within ${OFFER_WINDOW_WEEKS} weeks.`);
      } else {
        app.status = 'rejected';
        bus.emit('casting', `Passed over: ${listing.characterName}`, decision.reason);
      }
    }
    for (const app of state.applications) {
      if (app.status !== 'applied') continue;
      const listing = findListing(state, app.listingId);
      if (!listing) { app.status = 'expired'; continue; }
      const { callback } = decideCallback(state, listing, ws);
      if (callback) {
        app.status = 'audition_pending';
        app.auditionWeek = week + 1;
        bus.emit('audition', `Callback: ${listing.characterName}`, 'You are in the room next week. Choose how to prepare.');
      } else {
        app.status = 'no_callback';
        bus.emit('audition', `No callback: ${listing.characterName}`, 'Casting went another way before you were seen.');
      }
    }

    // Direct offers: a studio sends a role straight to a name.
    if (!state.activeProduction) {
      const direct = findDirectOffer(state, ws);
      if (direct) {
        const { movie, role } = direct;
        const director = ws.directors.get(movie.directorId)!;
        const rng = rngFor(state.worldSeed, movie.id, week, `direct-listing:${role.id}`);
        const listingId = `l-${role.id}`;
        if (!state.listings.some((l) => l.id === listingId)) {
          state.listings.push({
            id: listingId, movieId: movie.id, roleId: role.id, characterName: role.characterName, roleType: role.roleType,
            expectedSalary: role.salary, difficulty: role.difficulty, requiredActing: role.requiredActing, preferredGenre: movie.genres[0],
            estimatedPrestige: estimateBand(movie.hidden.scriptQuality * 0.7 + director.prestige * 0.3, rng),
            estimatedCommercial: estimateBand(movie.hidden.commercialPotential, rng),
            competitorIds: shortlistFor(state.worldSeed, movie, role, ws, week).map((x) => x.id),
            postedWeek: week, expiresWeek: movie.castingCloseWeek,
          });
        }
        const contract = generateOffer(state, ws, movie, role, {
          direct: true, agent, careerGross,
          playerFit: playerFit(state, movie, role), bestAlternativeFit: bestAlternativeFit(state.worldSeed, movie, role, ws, week),
        });
        state.applications.push({
          listingId, movieId: movie.id, roleId: role.id, movieTitle: movie.title, characterName: role.characterName, roleType: role.roleType,
          appliedWeek: week, status: 'offer', source: 'direct', contract, offerExpiresWeek: week + OFFER_WINDOW_WEEKS, prepBonus: 1,
        });
        bus.emit('casting', `Direct offer: ${role.characterName} in ${movie.title}`, `${ws.studios.get(movie.studioId)?.name} wants you for the ${role.roleType} — no audition. Opening at $${contract.terms.baseSalary.toLocaleString()}.`);
      }
    }

    // Withdrawn deals close their applications.
    for (const app of state.applications) {
      if (app.status === 'offer' && app.contract?.status === 'withdrawn') app.status = 'expired';
    }

    tickAgentApproaches(state, bus);
  }

  // 1b. Productions that fall apart. The player's booking is handled here (pay-or-play has teeth).
  //     Sweeps every cancelled film the player is still attached to, not just this week's, so a
  //     booking can never outlive its film.
  tickCancellations(state, ws, bus);
  const LIVE = new Set(['booked', 'offer', 'applied', 'audition_pending']);
  const deadWithPlayer = new Set<string>();
  for (const a of state.applications) if (LIVE.has(a.status) && ws.movies.get(a.movieId)?.status === 'cancelled') deadWithPlayer.add(a.movieId);
  for (const id of [...state.trackedMovieIds, ...player.activeMovieIds]) if (ws.movies.get(id)?.status === 'cancelled') deadWithPlayer.add(id);
  for (const l of state.listings) if (ws.movies.get(l.movieId)?.status === 'cancelled') deadWithPlayer.add(l.movieId);
  for (const movieId of deadWithPlayer) {
    const movie = ws.movies.get(movieId)!;
    state.listings = state.listings.filter((l) => l.movieId !== movie.id);
    state.trackedMovieIds = state.trackedMovieIds.filter((id) => id !== movie.id);
    player.activeMovieIds = player.activeMovieIds.filter((id) => id !== movie.id);
    // Every live application on the film (the player can be up for more than one part).
    for (const app of state.applications) {
      if (app.movieId !== movie.id || !LIVE.has(app.status)) continue;
      const wasBooked = app.status === 'booked';
      app.status = 'expired';
      if (wasBooked && app.contract?.terms.payOrPlay) {
        const pay = app.contract.terms.baseSalary;
        player.cash += pay;
        player.careerEarnings += pay;
        bus.emit('contract', `${movie.title} collapses — and you get paid anyway`, `Pay-or-play: $${pay.toLocaleString()} for a film that will never shoot (${movie.cancelledReason}).`);
      } else if (wasBooked) {
        bus.emit('casting', `${movie.title} collapses`, `The production is dead: ${movie.cancelledReason}. No shoot, no paycheck.`);
      } else {
        bus.emit('audition', `${movie.title} collapses`, `The role you were up for no longer exists: ${movie.cancelledReason}.`);
      }
    }
  }

  // 2. Studios greenlight; casting windows close (roles the player is still up for are held).
  greenlightSlates(state, ws, bus);
  for (const movie of ws.movies.values()) {
    if (movie.status !== 'casting') continue;
    if (movie.castingCloseWeek > week) continue;
    const force = week >= movie.productionStartWeek || week >= movie.castingCloseWeek + 4;
    closeCasting(state, movie, ws, bus, force);
  }
  if (!worldOnly) refreshListings(state, ws, bus);

  // 3. Movie calendar for the whole industry: shoots start, NPC shoots wrap, films open.
  const beginPlayerShoot = (movie: Movie): boolean => {
    if (state.activeProduction) return false;
    const app = state.applications.find((a) => a.status === 'booked' && a.movieId === movie.id);
    const role = movie.roles.find((r) => r.castPersonId === player.id);
    const entry = movie.cast.find((c) => c.personId === player.id);
    if (!app || !role || !entry) return false;
    startProduction(state, movie, app, role, entry.salary);
    app.status = 'in_production';
    return true;
  };
  const transitions = tickMovies(state, ws, bus);
  // Player films in a stable order so the same save always starts the same one first.
  const ready = transitions.filter((t) => t.to === 'player-ready').map((t) => ws.movies.get(t.movieId)!)
    .sort((a, b) => a.productionStartWeek - b.productionStartWeek || (a.id < b.id ? -1 : 1));
  for (const movie of ready) {
    if (!state.activeProduction && beginPlayerShoot(movie)) {
      movie.status = 'filming';
      markDirty(ws, 'movies', movie.id);
      bus.emit('production', `${movie.title} starts filming`, `Principal photography begins — ${movie.productionWeeks} weeks scheduled.`);
      continue;
    }
    // On another set: the production pushes its start, then gives up and recasts.
    movie.holdWeeks = (movie.holdWeeks ?? 0) + 1;
    movie.productionStartWeek = week + 1;
    markDirty(ws, 'movies', movie.id);
    if (movie.holdWeeks > MAX_HOLD_WEEKS) {
      replacePlayer(state, movie, ws, bus);
      movie.productionStartWeek = week;
      movie.status = 'filming';
    } else {
      bus.emit('production', `${movie.title} is waiting for you`, `The shoot has been pushed ${movie.holdWeeks} week${movie.holdWeeks === 1 ? '' : 's'} while you finish your current film. It recasts after ${MAX_HOLD_WEEKS}.`);
    }
  }
  for (const t of transitions) {
    if (t.to === 'player-ready') continue;
    const movie = ws.movies.get(t.movieId)!;
    if (t.to === 'wrapped') {
      finalizeWrap(state, ws, movie, undefined, bus);
    } else if (t.to === 'released') {
      const run = openRun(state.worldSeed, week, movie, ws);
      markDirty(ws, 'movies', movie.id);
      if (hasPlayer(movie, player.id)) {
        bus.emit('box_office', `${movie.title} — opening weekend`, `Domestic ${formatMoney(run.openingDomestic)} · International ${formatMoney(run.openingInternational)} · Worldwide ${formatMoney(run.worldwide)}`);
      } else if (movie.budget >= 40_000_000 || run.worldwide >= 30_000_000) {
        bus.emit('industry', `${movie.title} opens to ${formatMoney(run.worldwide)} worldwide`, `${ws.studios.get(movie.studioId)?.name} · ${movie.genres.join('/')} · budget ${formatMoney(movie.budget)}.`);
      }
    }
  }

  // 3b. Recovery: a player film already marked filming with no shoot running (e.g. a save from
  //     before hold-and-recast existed) starts its shoot now rather than hanging forever.
  if (!worldOnly && !state.activeProduction) {
    for (const movie of ws.movies.values()) {
      if (movie.status !== 'filming' || !hasPlayer(movie, player.id)) continue;
      if (beginPlayerShoot(movie)) {
        bus.emit('production', `${movie.title} starts filming`, `The production waited for you — ${movie.productionWeeks} weeks scheduled.`);
        break;
      }
    }
  }

  // 4. The player's shoot. On wrap, P and Q are evaluated and sealed until release.
  if (!worldOnly && state.activeProduction) {
    const production = state.activeProduction;
    const wrapped = tickProduction(state, ws, bus);
    if (wrapped) {
      const movie = ws.movies.get(production.movieId)!;
      const ctx: PerformanceContext = {
        roleType: production.roleType, prepBonus: production.prepBonus, performanceMod: production.performanceMod,
        energy: player.energy, stress: player.stress,
      };
      finalizeWrap(state, ws, movie, ctx, bus);
      state.activeProduction = null;
      bus.emit('production', `${movie.title} in post-production`, `Release set for ${formatDate(movie.releaseWeek!, state.epochYear)}.`);
    }
  }

  // 5. Theatrical runs for every released film (opened this week → next tick starts week 2).
  let weekTop: { movie: Movie; weekly: number } | null = null;
  for (const movie of ws.movies.values()) {
    if (movie.status !== 'released' || !movie.boxOffice) continue;
    const run = movie.boxOffice;
    const last = run.weeks[run.weeks.length - 1];
    if (last.week === week) {
      const weekly = last.domestic + last.international;
      if (!weekTop || weekly > weekTop.weekly) weekTop = { movie, weekly };
      continue;
    }
    const finished = tickRun(state.worldSeed, week, movie);
    markDirty(ws, 'movies', movie.id);
    const i = run.weeks.length - 1;
    const now = run.weeks[i];
    const weekly = now.domestic + now.international;
    if (!weekTop || weekly > weekTop.weekly) weekTop = { movie, weekly };
    if (hasPlayer(movie, player.id)) {
      const wow = weekOverWeek(run, i);
      bus.emit('box_office', `${movie.title} — week ${i + 1}`, `Domestic ${formatMoney(now.domestic)}${wow !== null ? ` (${wow >= 0 ? '+' : ''}${Math.round(wow * 100)}%)` : ''} · International ${formatMoney(now.international)} · Total ${formatMoney(run.worldwide)}`);
    }
    if (finished) resolveRun(state, ws, movie, bus);
  }
  if (weekTop && !worldOnly) {
    bus.emit('industry', `Box office: ${weekTop.movie.title} leads the week`, `${formatMoney(weekTop.weekly)} worldwide this week · ${formatMoney(weekTop.movie.boxOffice!.worldwide)} to date.`);
  }

  // 6. The living cohort: drift, aging, retirements, newcomers.
  npcWeeklyDrift(state.worldSeed, week, ws);
  tickCareers(state, ws, bus);

  // 7. Close the week.
  const events = bus.events();
  if (!worldOnly) {
    markDirty(ws, 'people', player.id);
    state.weeklyReport = events;
    state.timeline.push(...events);
    if (state.timeline.length > TIMELINE_CAP) state.timeline.splice(0, state.timeline.length - TIMELINE_CAP);
    state.weekPlan = [];
  }
  return events;
}

// ---------------------------------------------------------------------------
// Wrap and release resolution (shared by player and NPC films)
// ---------------------------------------------------------------------------

/** Evaluate Q for the film and P for every cast member, then wrap it. */
function finalizeWrap(state: GameState, ws: WorkingSet, movie: Movie, playerCtx: PerformanceContext | undefined, bus: EventBus): void {
  const { worldSeed, week } = state;
  for (const c of movie.cast) {
    const person = ws.people.get(c.personId);
    if (!person) continue;
    const ctx = person.isPlayer && playerCtx ? playerCtx : npcPerformanceContext(person, movie, c.roleType);
    c.performance = evaluatePerformance(worldSeed, week, person, movie, ctx, ws);
  }
  movie.quality = evaluateQuality(worldSeed, week, movie, ws);
  wrapMovie(state, ws, movie.id);
  void bus;
}

/** The run is over: verdict is set; route each axis to every cast member's career. */
function resolveRun(state: GameState, ws: WorkingSet, movie: Movie, bus: EventBus): void {
  const run = movie.boxOffice!;
  const quality = movie.quality!;
  const player = state.player;

  for (const c of movie.cast) {
    const person = ws.people.get(c.personId);
    if (!person || !c.performance) continue;
    const fromPerformance = performanceImpacts(movie, c.roleType, ws, c.performance);
    const fromQuality = qualityImpacts(movie, roleInfluence(c.roleType), quality);
    const fromCommercial = commercialImpacts(movie, c.roleType, run, ws);
    const starBefore = person.attributes.starPower;
    applyPerformanceImpacts(person, ws, fromPerformance);
    applyQualityImpacts(person, fromQuality);
    applyCommercialImpacts(person, ws, fromCommercial);
    const credit = person.filmography.find((f) => f.movieId === movie.id);
    if (credit) {
      credit.performance = c.performance;
      credit.ageAtRelease = ageInYears(person, state.week);
    }
    if (person.attributes.starPower > person.peakStarPower) person.peakStarPower = person.attributes.starPower;
    markDirty(ws, 'people', person.id);

    if (person.isPlayer) {
      if (c.contract) {
        const payout = computePayout(c.contract, run, movie, agentFor(state));
        if (payout.bonus + payout.gross + payout.net > 0) {
          person.cash += payout.total;
          person.careerEarnings += payout.bonus + payout.gross + payout.net;
          person.backendEarnings += payout.total;
          fromCommercial.push({ target: 'cash', label: 'Backend paid', amount: payout.total });
          bus.emit('contract', `${movie.title} backend: $${payout.total.toLocaleString()}`, `${payout.bonus ? `bonus $${payout.bonus.toLocaleString()} · ` : ''}${payout.gross ? `gross points $${payout.gross.toLocaleString()} · ` : ''}${payout.net ? `net points $${payout.net.toLocaleString()} · ` : ''}${payout.commission ? `commission $${payout.commission.toLocaleString()}` : 'no commission'}`);
        } else if (c.contract.netPoints > 0) {
          bus.emit('contract', `${movie.title} backend: $0`, `Your ${c.contract.netPoints} net points paid nothing — the studio's accountants found no "net profit". Welcome to Hollywood.`);
        }
      }
      state.pendingResults.push(buildResult(state, movie, c.characterName, c.roleType, c.performance, quality, { fromPerformance, fromQuality, fromCommercial }));
      state.trackedMovieIds = state.trackedMovieIds.filter((id) => id !== movie.id);
      bus.emit('result', `${movie.title} — ${run.verdict}`, state.pendingResults[state.pendingResults.length - 1].headline);
    } else if (starBefore < 40 && person.attributes.starPower >= 40 && (c.roleType === 'Lead' || c.roleType === 'Main Protagonist' || c.roleType === 'Co-Lead')) {
      bus.emit('industry', `Breakout: ${fullName(person)}`, `${movie.title} (${run.verdict}) turns an unknown into ${starTier(person.attributes.starPower)} material.`);
    }
  }

  recordDirectorResult(ws, movie);
  recordStudioResult(ws, movie);
  completeMovie(ws, movie.id);

  const notable = movie.budget >= 40_000_000 || run.worldwide >= 50_000_000 || run.verdict === 'All-Time Blockbuster' || (run.verdict === 'Disaster' && movie.budget >= 10_000_000);
  if (notable && !hasPlayer(movie, player.id)) {
    bus.emit('industry', `${movie.title} finishes as a ${run.verdict}`, `${formatMoney(run.worldwide)} worldwide on a ${formatMoney(movie.budget)} budget · critics ${quality.criticScore}% · audience ${quality.audienceScore}%.`);
  }
}

function buildResult(
  state: GameState, movie: Movie, characterName: string, roleType: MovieResult['roleType'], perf: PerformanceResult, quality: QualityResult,
  impacts: { fromPerformance: StatDelta[]; fromQuality: StatDelta[]; fromCommercial: StatDelta[] },
): MovieResult {
  const run = movie.boxOffice!;
  return {
    movieId: movie.id,
    title: movie.title,
    characterName,
    roleType,
    performance: perf,
    quality,
    boxOffice: run,
    impacts,
    headline: headlineFor(fullName(state.player).toUpperCase(), state.player.lastName.toUpperCase(), movie.title.toUpperCase(), perf, quality, run.verdict!),
    weekResolved: state.week,
  };
}

/** Headlines are where the three axes visibly diverge. */
function headlineFor(name: string, surname: string, title: string, perf: PerformanceResult, quality: QualityResult, verdict: Verdict): string {
  const p = perf.score;
  const goodQ = quality.q >= 65;
  const badQ = quality.q < 45;
  const hit = verdict === 'Hit' || verdict === 'Super Hit' || verdict === 'Blockbuster' || verdict === 'All-Time Blockbuster';
  const bomb = verdict === 'Disaster' || verdict === 'Flop';

  if (p >= 5 && bomb) return `${surname} DELIVERS TOUR-DE-FORCE IN ${title} — BUT NOBODY CAME`;
  if (p >= 4 && goodQ && hit) return `${surname} DELIVERS CAREER-BEST PERFORMANCE AS ${title} BECOMES A ${verdict.toUpperCase()}`;
  if (p >= 4 && badQ && hit) return `${title} IS CRITIC-PROOF: A ${verdict.toUpperCase()} — AND ${surname} IS ITS ONE BRIGHT SPOT`;
  if (p >= 4 && goodQ && bomb) return `${title} IS A MISUNDERSTOOD GEM — ${surname} PRAISED AS IT ${verdict === 'Disaster' ? 'BOMBS' : 'FLOPS'}`;
  if (p <= 2 && goodQ && hit) return `${title} SOARS TO ${verdict.toUpperCase()} STATUS; ${surname} CALLED THE WEAK LINK`;
  if (p <= 2 && badQ && bomb) return `${title} SINKS — AND TAKES ${surname} DOWN WITH IT`;
  if (p <= 2 && hit) return `${title} IS A ${verdict.toUpperCase()} — DESPITE ${surname}`;
  if (hit) return `${title} OPENS TO ${verdict.toUpperCase()} NUMBERS; ${surname} SOLID IN SUPPORT`;
  if (bomb) return `${title} STUMBLES AT THE BOX OFFICE; ${name} MOVES ON`;
  return `${title} LANDS AS AN ${verdict.toUpperCase()} PERFORMER; ${surname} ${p >= 3 ? 'EARNS GOOD NOTICES' : 'GOES UNNOTICED'}`;
}
