/**
 * Game — the headless session facade.
 *
 * Everything outside the engines (the Svelte UI, tests, a future Worker host) talks to a Game:
 *   - create / load a universe
 *   - issue player commands (plan actions, choose prep, answer offers)
 *   - `endWeek()` — the synchronous tick — followed by `persist()`
 *
 * No DOM, no framework. SaveEngine is optional so tests can run fully in memory.
 */
import {
  createWorkingSet, markDirty, type GameState, type Id, type PlannedAction, type PrepChoice,
  type TimelineEvent, type WorkingSet,
} from './GameState';
import { seedFromString } from './RNG';
import { advanceWeek } from './TimeEngine';
import { EventBus } from './EventBus';
import { ACTION_COSTS, createPlayer, dayJobById, type PlayerSpec } from '../sim/ActorEngine';
import { seedUniverse, studioFromTemplate } from '../world/IndustryEngine';
import { acceptOffer, applyBlockedReason, declineOffer, findApplication, findListing, readScriptBlockedReason, refreshListings, setPrep } from '../industry/AuditionEngine';
import { counterOffer } from '../industry/ContractEngine';
import { fireAgent, generateAgents, hireAgent } from '../world/AgentEngine';
import type { CounterMove, DayJobId, NegotiationEvent } from './GameState';
import { attachPerson } from '../industry/MovieEngine';
import { SAVE_VERSION, type SaveEngine } from '../meta/SaveEngine';
import { generateActor, takenNames } from '../sim/NPCEngine';
import { generateDirector } from '../world/DirectorEngine';

export const EPOCH_YEAR = 2028;
/** Week 8 of 2028 = March, week 1 (4-4-5 calendar). */
export const START_WEEK = 8;
/** The world runs this long on its own before the player enters. */
export const PREHISTORY_WEEKS = 52;
export const ACTIONS_PER_WEEK = 3;
export const WEEKLY_EXPENSES = 250;

function actionCash(action: PlannedAction): number {
  return ACTION_COSTS[action.type].cash;
}

export interface NewGameOptions {
  player: PlayerSpec;
  /** Human-readable seed; the same seed replays identically. */
  seed: string;
  universeId?: Id;
  /** Override the prehistory length (tests). */
  prehistoryWeeks?: number;
}

/**
 * Fill holes in a loaded universe: a film whose director or cast member is missing from the
 * tables gets a regenerated stand-in under the same id (deterministic per world seed), and hot
 * state pointing at films that no longer exist is dropped. Returns how many records were rebuilt.
 * Saves written before the persist race was fixed can have such holes; new saves should not.
 */
export function repairWorkingSet(state: GameState, ws: WorkingSet): number {
  let repaired = 0;
  const names = takenNames(ws);
  const weekFromId = (id: Id): number => {
    const m = /^[dp]-(-?\d+)-/.exec(id);
    return m ? Number(m[1]) : state.week;
  };
  for (const movie of ws.movies.values()) {
    if (!ws.studios.has(movie.studioId)) {
      const st = studioFromTemplate(state.universeId, movie.studioId);
      if (st) {
        ws.studios.set(st.id, st);
        markDirty(ws, 'studios', st.id);
        repaired += 1;
      }
    }
    if (!ws.directors.has(movie.directorId)) {
      const d = generateDirector(state.universeId, state.worldSeed, weekFromId(movie.directorId), movie.directorId, 'working', names);
      ws.directors.set(d.id, d);
      markDirty(ws, 'directors', d.id);
      repaired += 1;
    }
    for (const c of movie.cast) {
      if (ws.people.has(c.personId)) continue;
      const p = generateActor(state.universeId, state.worldSeed, weekFromId(c.personId), c.personId, 'working', names);
      if (movie.status === 'casting' || movie.status === 'pre-production' || movie.status === 'filming') p.activeMovieIds.push(movie.id);
      ws.people.set(p.id, p);
      markDirty(ws, 'people', p.id);
      repaired += 1;
    }
  }
  // People and directors pointing at films that were lost.
  for (const p of ws.people.values()) {
    const kept = p.activeMovieIds.filter((id) => ws.movies.has(id));
    if (kept.length !== p.activeMovieIds.length) { p.activeMovieIds = kept; markDirty(ws, 'people', p.id); repaired += 1; }
  }
  for (const d of ws.directors.values()) {
    if (d.activeMovieId && !ws.movies.has(d.activeMovieId)) { d.activeMovieId = undefined; markDirty(ws, 'directors', d.id); repaired += 1; }
  }
  const before = state.listings.length + state.applications.length + state.trackedMovieIds.length;
  state.listings = state.listings.filter((l) => ws.movies.has(l.movieId));
  state.applications = state.applications.filter((a) => ws.movies.has(a.movieId));
  state.trackedMovieIds = state.trackedMovieIds.filter((id) => ws.movies.has(id));
  if (state.activeProduction && !ws.movies.has(state.activeProduction.movieId)) state.activeProduction = null;
  repaired += before - (state.listings.length + state.applications.length + state.trackedMovieIds.length);
  return repaired;
}

export class Game {
  readonly state: GameState;
  readonly ws: WorkingSet;
  /** Records rebuilt by `repairWorkingSet` when this session was loaded (0 for a healthy save). */
  repairedOnLoad = 0;
  private readonly save: SaveEngine | null;

  private constructor(state: GameState, ws: WorkingSet, save: SaveEngine | null) {
    this.state = state;
    this.ws = ws;
    this.save = save;
  }

  // --- lifecycle ------------------------------------------------------------

  /** Build a fresh universe in memory, run its prehistory, then seat the player. Deterministic for (seed, spec). */
  static create(opts: NewGameOptions, save: SaveEngine | null = null): Game {
    const worldSeed = seedFromString(opts.seed);
    const universeId = opts.universeId ?? `u-${worldSeed.toString(36)}`;
    const prehistory = opts.prehistoryWeeks ?? PREHISTORY_WEEKS;
    const worldStart = START_WEEK - prehistory;

    const ws = createWorkingSet();
    const seed = seedUniverse(universeId, worldSeed, worldStart);
    for (const s of seed.studios) ws.studios.set(s.id, s);
    for (const d of seed.directors) ws.directors.set(d.id, d);
    for (const p of seed.people) ws.people.set(p.id, p);

    const player = createPlayer(universeId, worldSeed, START_WEEK, opts.player);
    const state: GameState = {
      saveVersion: SAVE_VERSION,
      universeId,
      worldSeed,
      week: worldStart,
      epochYear: EPOCH_YEAR,
      player,
      actionsPerWeek: ACTIONS_PER_WEEK,
      weekPlan: [],
      listings: [],
      applications: [],
      activeProduction: null,
      trackedMovieIds: [],
      pendingResults: [],
      weeklyReport: [],
      timeline: [],
      weeklyExpenses: WEEKLY_EXPENSES,
      dayJob: 'cafe',
      genCounter: seed.genCounter,
      agents: generateAgents(universeId, worldSeed),
      agentApproaches: [],
    };

    // The world existed before you: studios slate, films shoot and open, careers move.
    for (let i = 0; i < prehistory; i++) advanceWeek(state, ws, { worldOnly: true });

    ws.people.set(player.id, player);
    const bus = new EventBus(state.week);
    refreshListings(state, ws, bus);
    state.weeklyReport = [{
      week: state.week, category: 'time', title: 'Welcome to the industry',
      description: `${player.firstName} ${player.lastName}, ${opts.player.background}, arrives with $${player.cash.toLocaleString()}, a dream, and café shifts that cover the rent between shoots. Apply to auditions, train, and end the week.`,
    }, ...bus.events()];
    state.timeline.push(...state.weeklyReport);
    return new Game(state, ws, save);
  }

  /** Create and persist a new universe. */
  static async createAndSave(opts: NewGameOptions, save: SaveEngine): Promise<Game> {
    const game = Game.create(opts, save);
    await save.persistAll(game.ws);
    await save.saveHot(game.state);
    return game;
  }

  static async load(save: SaveEngine, universeId: Id): Promise<Game | null> {
    const state = await save.loadHot(universeId);
    if (!state) return null;
    const ws = await save.loadWorkingSet(universeId);
    // The hot player copy is authoritative; keep the table's row pointing at the same object.
    ws.people.set(state.player.id, state.player);
    if (state.dayJob === undefined) state.dayJob = null;
    const game = new Game(state, ws, save);
    const repaired = repairWorkingSet(state, ws);
    game.repairedOnLoad = repaired;
    if (repaired > 0) await game.persist();
    return game;
  }

  // --- commands (synchronous, validated) ----------------------------------------

  get actionsRemaining(): number {
    return this.state.actionsPerWeek - this.state.weekPlan.length;
  }

  planAction(action: PlannedAction): void {
    if (this.actionsRemaining <= 0) throw new Error('No actions left this week.');
    if (action.type === 'apply') {
      const reason = applyBlockedReason(this.state, this.ws, action.listingId);
      if (reason) throw new Error(reason);
    }
    if (action.type === 'read_script') {
      const reason = readScriptBlockedReason(this.state, action.listingId);
      if (reason) throw new Error(reason);
    }
    if (action.type === 'rest' && this.state.weekPlan.some((a) => a.type === 'rest')) {
      throw new Error('Resting twice in a week does nothing extra.');
    }
    const cost = this.plannedCost() + actionCash(action);
    if (actionCash(action) > 0 && cost > this.state.player.cash) {
      throw new Error(`Not enough cash — this costs $${actionCash(action)} and you have $${Math.max(0, this.state.player.cash - this.plannedCost()).toLocaleString()} unallocated.`);
    }
    this.state.weekPlan.push(action);
  }

  /** Cash already committed by this week's plan. */
  plannedCost(): number {
    return this.state.weekPlan.reduce((s, a) => s + actionCash(a), 0);
  }

  unplanAction(index: number): void {
    this.state.weekPlan.splice(index, 1);
  }

  choosePrep(listingId: Id, prep: PrepChoice): void {
    setPrep(this.state, listingId, prep);
  }

  acceptOffer(listingId: Id): void {
    const listing = findListing(this.state, listingId);
    const movie = listing ? this.ws.movies.get(listing.movieId) : undefined;
    const role = movie?.roles.find((r) => r.id === listing!.roleId);
    if (!listing || !movie || !role) throw new Error('That role no longer exists.');
    if (role.castPersonId) throw new Error('The role has already been cast.');
    const app = findApplication(this.state, listingId)!;
    acceptOffer(this.state, this.ws, listingId);
    const terms = app.contract?.terms;
    attachPerson(this.ws, movie, this.state.player, role, terms?.baseSalary ?? listing.expectedSalary);
    const entry = movie.cast.find((c) => c.personId === this.state.player.id);
    if (entry && terms) {
      entry.contract = structuredClone(terms);
      // Negotiated billing is honoured (top billing bumps the player above the existing lead).
      if (terms.billing < entry.billing) {
        entry.billing = terms.billing - 0.5;
        movie.cast.slice().sort((a, b) => a.billing - b.billing).forEach((c, i) => { c.billing = i + 1; });
      }
    }
    this.state.trackedMovieIds.push(movie.id);
    this.state.weeklyReport.push({
      week: this.state.week, category: 'casting', title: `Booked: ${listing.characterName}`,
      description: `You accepted the ${listing.roleType} role in ${movie.title}. Filming starts in ${Math.max(0, movie.productionStartWeek - this.state.week)} weeks.`,
    });
  }

  declineOffer(listingId: Id): void {
    declineOffer(this.state, listingId);
  }

  /** Push on one term of a live offer. The studio replies immediately; it may walk. */
  counterOffer(listingId: Id, move: CounterMove): NegotiationEvent {
    const app = findApplication(this.state, listingId);
    if (!app || app.status !== 'offer' || !app.contract) throw new Error('No live offer to negotiate.');
    const movie = this.ws.movies.get(app.movieId);
    const role = movie?.roles.find((r) => r.id === app.roleId);
    if (!movie || !role) throw new Error('That role no longer exists.');
    const ev = counterOffer(this.state, this.ws, movie, role, app.contract, move);
    if (app.contract.status === 'withdrawn') {
      app.status = 'expired';
      this.state.weeklyReport.push({ week: this.state.week, category: 'contract', title: `Offer withdrawn: ${app.characterName}`, description: ev.text });
    }
    return ev;
  }

  hireAgent(agentId: Id): void {
    const agent = hireAgent(this.state, agentId);
    this.state.weeklyReport.push({ week: this.state.week, category: 'agent', title: `Signed with ${agent.agency}`, description: `${agent.firstName} ${agent.lastName} now represents you at ${Math.round(agent.commission * 100)}% commission.` });
  }

  fireAgent(): void {
    fireAgent(this.state);
  }

  takeDayJob(id: DayJobId): void {
    const job = dayJobById(id);
    if (!job) throw new Error('No such job.');
    if (this.state.dayJob === id) throw new Error('You already work there.');
    this.state.dayJob = id;
    this.state.weeklyReport.push({ week: this.state.week, category: 'finance', title: `Started ${job.name.toLowerCase()}`, description: `$${job.pay}/week for ${job.energy} energy. On hold whenever you're on a set.` });
  }

  quitDayJob(): void {
    const job = dayJobById(this.state.dayJob);
    if (!job) throw new Error('You have no day job to quit.');
    this.state.dayJob = null;
    this.state.weeklyReport.push({ week: this.state.week, category: 'finance', title: `Quit ${job.name.toLowerCase()}`, description: `Rent is $${this.state.weeklyExpenses}/week with nothing coming in between shoots.` });
  }

  declineApproach(agentId: Id): void {
    this.state.agentApproaches = this.state.agentApproaches.filter((id) => id !== agentId);
  }

  dismissResult(): void {
    this.state.pendingResults.shift();
  }

  // --- the turn --------------------------------------------------------------

  /** Advance one week. Synchronous; no I/O. Call `persist()` afterwards. */
  endWeek(): TimelineEvent[] {
    return advanceWeek(this.state, this.ws);
  }

  /** Persist hot state + dirty entities. No-op when running headless. */
  async persist(): Promise<void> {
    if (!this.save) return;
    markDirty(this.ws, 'people', this.state.player.id);
    await this.save.persistDeltas(this.ws);
    await this.save.saveHot(this.state);
  }

  /** Convenience for hosts: tick then persist. */
  async endWeekAndPersist(): Promise<TimelineEvent[]> {
    const events = this.endWeek();
    await this.persist();
    return events;
  }
}
