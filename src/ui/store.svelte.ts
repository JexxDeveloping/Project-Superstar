/**
 * UI store — a thin reactive shell around the headless Game.
 *
 * Presentation only. Every mutation goes through a Game command; after each one the store takes
 * an immutable snapshot of the hot state + working set for Svelte to render. No simulation
 * logic lives here or in any component.
 */
import { Game, type NewGameOptions } from '../core/Game';
import { SaveEngine, type SaveSlotMeta } from '../meta/SaveEngine';
import type {
  Agent, CounterMove, DayJobId, Director, GameState, Id, Movie, NegotiationEvent, Person, PlannedAction, PrepChoice, Studio,
} from '../core/GameState';

export interface WorldView {
  movies: Map<Id, Movie>;
  directors: Map<Id, Director>;
  studios: Map<Id, Studio>;
  people: Map<Id, Person>;
}

export type Screen = 'home' | 'auditions' | 'scripts' | 'production' | 'career' | 'industry' | 'timeline';

const SKIP_MAX_WEEKS = 26;

class GameStore {
  state = $state.raw<GameState | null>(null);
  world = $state.raw<WorldView | null>(null);
  /** Bumped on every refresh; screens are keyed on it so in-place entity changes always render. */
  version = $state(0);
  actionsRemaining = $state(0);
  busy = $state(false);
  error = $state<string | null>(null);
  screen = $state<Screen>('home');
  saves = $state<SaveSlotMeta[]>([]);
  /** Listing currently open in the audition modal. */
  openListingId = $state<Id | null>(null);
  /** Offer currently open in the contract modal. */
  openContractListingId = $state<Id | null>(null);
  /** The studio's reply to the last counter, for the modal to show. */
  lastNegotiation = $state<NegotiationEvent | null>(null);

  private game: Game | null = null;
  private readonly save = new SaveEngine();
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  /** Saves run strictly one after another, in the order they were requested. */
  private persistChain: Promise<void> = Promise.resolve();

  // --- lifecycle ------------------------------------------------------------

  async init(): Promise<void> {
    this.saves = await this.save.listSaves();
  }

  async newGame(opts: NewGameOptions): Promise<void> {
    await this.run(async () => {
      this.game = await Game.createAndSave(opts, this.save);
      this.screen = 'home';
      this.openListingId = null; this.openContractListingId = null; this.lastNegotiation = null;
      this.refresh();
    });
  }

  async loadGame(universeId: Id): Promise<void> {
    await this.run(async () => {
      const meta = this.saves.find((s) => s.universeId === universeId);
      if (meta && !meta.compatible) throw new Error(`That save is from an older version (v${meta.saveVersion}). Delete it and start a new career.`);
      const game = await Game.load(this.save, universeId);
      if (!game) throw new Error('That save could not be loaded.');
      this.game = game;
      this.screen = 'home';
      this.openListingId = null; this.openContractListingId = null; this.lastNegotiation = null;
      this.refresh();
      if (game.repairedOnLoad > 0) this.showError(`Save repaired: ${game.repairedOnLoad} missing record${game.repairedOnLoad === 1 ? '' : 's'} rebuilt.`);
    });
  }

  async deleteSave(universeId: Id): Promise<void> {
    await this.run(async () => {
      await this.save.deleteUniverse(universeId);
      this.saves = await this.save.listSaves();
    });
  }

  async quitToMenu(): Promise<void> {
    if (this.game) await this.enqueuePersist();
    this.game = null;
    this.state = null;
    this.world = null;
    this.saves = await this.save.listSaves();
  }

  // --- the turn --------------------------------------------------------------

  async endWeek(): Promise<void> {
    await this.run(async () => {
      await this.persistChain;
      this.game!.endWeek();
      this.refresh();
      await this.enqueuePersist();
    });
  }

  /** Advance until something needs the player, or nothing is in motion, or 26 weeks pass. */
  async skipToEvent(): Promise<void> {
    await this.run(async () => {
      const game = this.game!;
      if (needsPlayer(game.state) && !game.state.weeklyReport.some((e) => e.category === 'release' || e.title.includes('starts filming') || e.title.includes('wraps') || e.title.includes('opening weekend'))) {
        throw new Error('Something needs your answer first — an audition to prepare, an offer, or an agent. Use End Week to advance anyway.');
      }
      await this.persistChain;
      for (let i = 0; i < SKIP_MAX_WEEKS; i++) {
        game.endWeek();
        if (needsPlayer(game.state) || nothingInMotion(game.state)) break;
      }
      this.refresh();
      await this.enqueuePersist();
    });
  }

  // --- commands ------------------------------------------------------------

  plan(action: PlannedAction): void { this.command(() => this.game!.planAction(action)); }
  unplan(index: number): void { this.command(() => this.game!.unplanAction(index)); }
  choosePrep(listingId: Id, prep: PrepChoice): void { this.command(() => this.game!.choosePrep(listingId, prep)); }
  acceptOffer(listingId: Id): void { this.command(() => this.game!.acceptOffer(listingId)); }
  declineOffer(listingId: Id): void { this.command(() => this.game!.declineOffer(listingId)); }
  dismissResult(): void { this.command(() => this.game!.dismissResult()); }
  counterOffer(listingId: Id, move: CounterMove): void {
    this.command(() => { this.lastNegotiation = this.game!.counterOffer(listingId, move); });
  }
  hireAgent(agentId: Id): void { this.command(() => this.game!.hireAgent(agentId)); }
  takeDayJob(id: DayJobId): void { this.command(() => this.game!.takeDayJob(id)); }
  quitDayJob(): void { this.command(() => this.game!.quitDayJob()); }
  fireAgent(): void { this.command(() => this.game!.fireAgent()); }
  declineApproach(agentId: Id): void { this.command(() => this.game!.declineApproach(agentId)); }

  /** Open the contract modal for a live offer (clears any reply left over from an earlier deal). */
  openContract(listingId: Id): void {
    this.lastNegotiation = null;
    this.openListingId = null;
    this.openContractListingId = listingId;
  }

  agent(): Agent | undefined {
    const s = this.state;
    return s?.player.agentId ? s.agents.find((a) => a.id === s.player.agentId) : undefined;
  }

  // --- lookups (snapshot) ----------------------------------------------------

  movie(id: Id): Movie | undefined { return this.world?.movies.get(id); }
  personName(id: Id): string { const p = this.world?.people.get(id); return p ? `${p.firstName} ${p.lastName}` : '—'; }
  director(id: Id): Director | undefined { return this.world?.directors.get(id); }
  studio(id: Id): Studio | undefined { return this.world?.studios.get(id); }
  person(id: Id): Person | undefined { return this.world?.people.get(id); }

  // --- internals -----------------------------------------------------------

  private command(fn: () => void): void {
    if (!this.game) return;
    try {
      fn();
      this.refresh();
      void this.enqueuePersist();
    } catch (e) {
      this.showError(e);
    }
  }

  private enqueuePersist(): Promise<void> {
    const game = this.game;
    if (!game) return Promise.resolve();
    const next = this.persistChain.then(() => game.persist()).catch((e) => this.showError(e));
    this.persistChain = next;
    return next;
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await fn();
    } catch (e) {
      this.showError(e);
    } finally {
      this.busy = false;
    }
  }

  private showError(e: unknown): void {
    this.error = e instanceof Error ? e.message : String(e);
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => { this.error = null; }, 3200);
  }

  private refresh(): void {
    const game = this.game;
    if (!game) return;
    this.state = structuredClone(game.state);
    // The working set is shared by reference: engines only mutate it inside synchronous commands/ticks,
    // never during a render, and a fresh wrapper object is enough to re-render every consumer.
    // Cloning ~4,000 films per click cost ~300 ms in a late-career save.
    this.world = {
      movies: game.ws.movies,
      directors: game.ws.directors,
      studios: game.ws.studios,
      people: game.ws.people,
    };
    this.actionsRemaining = game.actionsRemaining;
    this.version += 1;
  }
}

function needsPlayer(s: GameState): boolean {
  if (s.pendingResults.length > 0) return true;
  if (s.applications.some((a) => a.status === 'offer' || (a.status === 'audition_pending' && !a.prep))) return true;
  if (s.agentApproaches.length > 0 && s.weeklyReport.some((e) => e.category === 'agent')) return true;
  return s.weeklyReport.some((e) =>
    e.category === 'result' || e.category === 'casting' || e.category === 'release' ||
    e.title.startsWith('Callback') || e.title.includes('starts filming') || e.title.includes('wraps') || e.title.includes('opening weekend'));
}

function nothingInMotion(s: GameState): boolean {
  const inFlight = s.applications.some((a) => a.status === 'applied' || a.status === 'audition_pending' || a.status === 'booked' || a.status === 'in_production');
  return !inFlight && !s.activeProduction && s.trackedMovieIds.length === 0;
}

export const store = new GameStore();
