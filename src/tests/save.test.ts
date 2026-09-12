import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { SaveEngine } from '../meta/SaveEngine';

const spec = { firstName: 'Save', lastName: 'Tester', gender: 'male' as const, background: 'Theater Actor' as const, archetype: 'Method Actor' as const };

describe('SaveEngine — Dexie persistence', () => {
  it('round-trips a new universe and its hot state', async () => {
    const save = new SaveEngine('test-db-roundtrip');
    const game = await Game.createAndSave({ player: spec, seed: 'save-1' }, save);
    const loaded = await Game.load(save, game.state.universeId);
    expect(loaded).not.toBeNull();
    expect(loaded!.state).toEqual(game.state);
    expect(loaded!.ws.movies.size).toBe(game.ws.movies.size);
    expect(loaded!.ws.people.size).toBe(game.ws.people.size);
    expect(loaded!.ws.studios.size).toBe(6);
    expect(loaded!.ws.directors.size).toBe(game.ws.directors.size);
    save.close();
  });

  it('persists deltas after ticks and resumes at the same week', async () => {
    const save = new SaveEngine('test-db-deltas');
    const game = await Game.createAndSave({ player: spec, seed: 'save-2' }, save);
    game.planAction({ type: 'acting_class' });
    await game.endWeekAndPersist();
    await game.endWeekAndPersist();
    const loaded = await Game.load(save, game.state.universeId);
    expect(loaded!.state.week).toBe(game.state.week);
    expect(loaded!.state.player.attributes.acting).toBeCloseTo(game.state.player.attributes.acting, 6);
    expect(loaded!.state.timeline.length).toBe(game.state.timeline.length);
    // Continuing from a load replays identically to continuing in memory.
    const a = game.endWeek();
    const b = loaded!.endWeek();
    expect(b).toEqual(a);
    save.close();
  });

  it('lists saves and deletes a universe cleanly', async () => {
    const save = new SaveEngine('test-db-list');
    const game = await Game.createAndSave({ player: spec, seed: 'save-3' }, save);
    const list = await save.listSaves();
    expect(list.map((s) => s.universeId)).toContain(game.state.universeId);
    await save.deleteUniverse(game.state.universeId);
    expect(await save.loadHot(game.state.universeId)).toBeNull();
    expect(await save.countMovies(game.state.universeId)).toBe(0);
    save.close();
  });
});
