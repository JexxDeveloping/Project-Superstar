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
  Director, GameState, Id, Movie, Person, PlannedAction, PrepChoice, Studio,
} from '../core/GameState';

export interface WorldView {
  movies: Map<Id, Movie>;
  directors: Map<Id, Director>;
  studios: Map<Id, Studio>;
  people: Map<Id, Person>;
}

export type Screen = 'home' | 'auditions' | 'production' | 'career' | 'industry' | 'timeline';

const SKIP_MAX_WEEKS = 26;

class GameStore {
  state = $state.raw<GameState | null>(null);
  world = $state.raw<WorldView | null>(null);
  actionsRemaining = $state(0);
  busy = $state(false);
  error = $state<string | null>(null);
  screen = $state<Screen>('home');
  saves = $state<SaveSlotMeta[]>([]);
  /** Listing currently open in the audition modal. */
  openListingId = $state<Id | null>(null);

  private game: Game | null = null;
  private readonly save = new SaveEngine();
  private errorTimer: ReturnType<typeof setTimeout> | null = null;

  // --- lifecycle ------------------------------------------------------------

  async init(): Promise<void> {
    this.saves = await this.save.listSaves();
  }

  async newGame(opts: NewGameOptions): Promise<void> {
    await this.run(async () => {
      this.game = await Game.createAndSave(opts, this.save);
      this.screen = 'home';
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
      this.refresh();
    });
  }

  async deleteSave(universeId: Id): Promise<void> {
    await this.run(async () => {
      await this.save.deleteUniverse(universeId);
      this.saves = await this.save.listSaves();
    });
  }

  async quitToMenu(): Promise<void> {
    if (this.game) await this.game.persist();
    this.game = null;
    this.state = null;
    this.world = null;
    this.saves = await this.save.listSaves();
  }

  // --- the turn --------------------------------------------------------------

  async endWeek(): Promise<void> {
    await this.run(async () => {
      this.game!.endWeek();
      await this.game!.persist();
      this.refresh();
    });
  }

  /** Advance until something needs the player, or nothing is in motion, or 26 weeks pass. */
  async skipToEvent(): Promise<void> {
    await this.run(async () => {
      const game = this.game!;
      for (let i = 0; i < SKIP_MAX_WEEKS; i++) {
        game.endWeek();
        if (needsPlayer(game.state) || nothingInMotion(game.state)) break;
      }
      await game.persist();
      this.refresh();
    });
  }

  // --- commands ------------------------------------------------------------

  plan(action: PlannedAction): void { this.command(() => this.game!.planAction(action)); }
  unplan(index: number): void { this.command(() => this.game!.unplanAction(index)); }
  choosePrep(listingId: Id, prep: PrepChoice): void { this.command(() => this.game!.choosePrep(listingId, prep)); }
  acceptOffer(listingId: Id): void { this.command(() => this.game!.acceptOffer(listingId)); }
  declineOffer(listingId: Id): void { this.command(() => this.game!.declineOffer(listingId)); }
  dismissResult(): void { this.command(() => this.game!.dismissResult()); }

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
      void this.game.persist();
    } catch (e) {
      this.showError(e);
    }
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
    this.world = {
      movies: structuredClone(game.ws.movies),
      directors: structuredClone(game.ws.directors),
      studios: structuredClone(game.ws.studios),
      people: structuredClone(game.ws.people),
    };
    this.actionsRemaining = game.actionsRemaining;
  }
}

function needsPlayer(s: GameState): boolean {
  if (s.pendingResults.length > 0) return true;
  if (s.applications.some((a) => a.status === 'offer' || (a.status === 'audition_pending' && !a.prep))) return true;
  return s.weeklyReport.some((e) =>
    e.category === 'result' || e.category === 'casting' || e.category === 'release' ||
    e.title.startsWith('Callback') || e.title.includes('starts filming') || e.title.includes('wraps') || e.title.includes('opening weekend'));
}

function nothingInMotion(s: GameState): boolean {
  const inFlight = s.applications.some((a) => a.status === 'applied' || a.status === 'audition_pending' || a.status === 'booked' || a.status === 'in_production');
  return !inFlight && !s.activeProduction && s.trackedMovieIds.length === 0;
}

export const store = new GameStore();
