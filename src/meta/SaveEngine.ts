/**
 * SaveEngine — the only module that touches Dexie / IndexedDB.
 *
 * Owns the schema, versions/migrations, and every read/write. Engines never import this; they
 * operate on the in-memory working set this module loads before a tick and persists (as deltas)
 * after it. Hot state is stored as one small record per universe.
 */
import Dexie, { type Table } from 'dexie';
import {
  createWorkingSet, clearDirty, type Director, type GameState, type Id, type Movie, type Person,
  type Studio, type WorkingSet,
} from '../core/GameState';

export const SAVE_VERSION = 2;

export interface SaveSlot {
  universeId: Id;
  state: GameState;
  savedAt: number;
  label: string;
}

export interface SaveSlotMeta {
  universeId: Id;
  savedAt: number;
  label: string;
  week: number;
  playerName: string;
  saveVersion: number;
  /** False when the save predates the current schema and can only be deleted. */
  compatible: boolean;
}

class SimDatabase extends Dexie {
  people!: Table<Person, Id>;
  movies!: Table<Movie, Id>;
  studios!: Table<Studio, Id>;
  directors!: Table<Director, Id>;
  saves!: Table<SaveSlot, Id>;

  constructor(name: string) {
    super(name);
    // Schema v1. Add `this.version(2).stores({...}).upgrade(...)` for migrations — never edit v1 in place.
    this.version(1).stores({
      people: 'id, universeId, status, [universeId+status]',
      movies: 'id, universeId, status, [universeId+status]',
      studios: 'id, universeId',
      directors: 'id, universeId',
      saves: 'universeId, savedAt',
    });
    // v2 (Phase 2): the same tables carry the living-world fields (roles, cast performances,
    // NPC/director career fields). Indexes are unchanged; Phase 1 hot states are flagged
    // incompatible by `listSaves` rather than migrated.
    this.version(2).stores({
      people: 'id, universeId, status, [universeId+status]',
      movies: 'id, universeId, status, [universeId+status]',
      studios: 'id, universeId',
      directors: 'id, universeId',
      saves: 'universeId, savedAt',
    });
  }
}

export class SaveEngine {
  private readonly db: SimDatabase;

  constructor(dbName = 'actor-career-sim') {
    this.db = new SimDatabase(dbName);
  }

  // --- hot state ------------------------------------------------------------

  async saveHot(state: GameState, label = 'Autosave'): Promise<void> {
    await this.db.saves.put({ universeId: state.universeId, state: structuredClone(state), savedAt: Date.now(), label });
  }

  async loadHot(universeId: Id): Promise<GameState | null> {
    const slot = await this.db.saves.get(universeId);
    if (!slot) return null;
    if ((slot.state.saveVersion ?? 1) !== SAVE_VERSION) {
      throw new Error(`This save is from an older version (v${slot.state.saveVersion ?? 1}) and can't be loaded. Delete it and start a new career.`);
    }
    return slot.state;
  }

  async listSaves(): Promise<SaveSlotMeta[]> {
    const slots = await this.db.saves.orderBy('savedAt').reverse().toArray();
    return slots.map((s) => ({
      universeId: s.universeId,
      savedAt: s.savedAt,
      label: s.label,
      week: s.state.week,
      playerName: `${s.state.player.firstName} ${s.state.player.lastName}`,
      saveVersion: s.state.saveVersion ?? 1,
      compatible: (s.state.saveVersion ?? 1) === SAVE_VERSION,
    }));
  }

  // --- working set ------------------------------------------------------------

  /** Load every entity for a universe. Phase 1 universes are small; later phases load slices. */
  async loadWorkingSet(universeId: Id): Promise<WorkingSet> {
    const ws = createWorkingSet();
    const [people, movies, studios, directors] = await Promise.all([
      this.db.people.where('universeId').equals(universeId).toArray(),
      this.db.movies.where('universeId').equals(universeId).toArray(),
      this.db.studios.where('universeId').equals(universeId).toArray(),
      this.db.directors.where('universeId').equals(universeId).toArray(),
    ]);
    for (const p of people) ws.people.set(p.id, p);
    for (const m of movies) ws.movies.set(m.id, m);
    for (const s of studios) ws.studios.set(s.id, s);
    for (const d of directors) ws.directors.set(d.id, d);
    return ws;
  }

  /** Write every entity (new universe). */
  async persistAll(ws: WorkingSet): Promise<void> {
    await this.db.transaction('rw', [this.db.people, this.db.movies, this.db.studios, this.db.directors], async () => {
      await this.db.people.bulkPut([...ws.people.values()].map((p) => structuredClone(p)));
      await this.db.movies.bulkPut([...ws.movies.values()].map((m) => structuredClone(m)));
      await this.db.studios.bulkPut([...ws.studios.values()].map((s) => structuredClone(s)));
      await this.db.directors.bulkPut([...ws.directors.values()].map((d) => structuredClone(d)));
    });
    clearDirty(ws);
  }

  /** Write only records marked dirty during the tick, then clear the marks. */
  async persistDeltas(ws: WorkingSet): Promise<void> {
    const pick = <T>(map: Map<Id, T>, ids: Set<Id>): T[] => {
      const out: T[] = [];
      for (const id of ids) { const v = map.get(id); if (v) out.push(structuredClone(v)); }
      return out;
    };
    const people = pick(ws.people, ws.dirty.people);
    const movies = pick(ws.movies, ws.dirty.movies);
    const studios = pick(ws.studios, ws.dirty.studios);
    const directors = pick(ws.directors, ws.dirty.directors);
    if (people.length + movies.length + studios.length + directors.length === 0) return;
    await this.db.transaction('rw', [this.db.people, this.db.movies, this.db.studios, this.db.directors], async () => {
      if (people.length) await this.db.people.bulkPut(people);
      if (movies.length) await this.db.movies.bulkPut(movies);
      if (studios.length) await this.db.studios.bulkPut(studios);
      if (directors.length) await this.db.directors.bulkPut(directors);
    });
    clearDirty(ws);
  }

  // --- lifecycle ------------------------------------------------------------

  async deleteUniverse(universeId: Id): Promise<void> {
    await this.db.transaction('rw', [this.db.people, this.db.movies, this.db.studios, this.db.directors, this.db.saves], async () => {
      await this.db.people.where('universeId').equals(universeId).delete();
      await this.db.movies.where('universeId').equals(universeId).delete();
      await this.db.studios.where('universeId').equals(universeId).delete();
      await this.db.directors.where('universeId').equals(universeId).delete();
      await this.db.saves.delete(universeId);
    });
  }

  async countMovies(universeId: Id): Promise<number> {
    return this.db.movies.where('universeId').equals(universeId).count();
  }

  close(): void {
    this.db.close();
  }
}
