/**
 * Order independence: a universe continued from a save must replay exactly like the one that
 * never left memory, even though a loaded working set comes back in id order rather than creation
 * order. Runs long enough for several studios to greenlight in the same week.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { SaveEngine } from '../meta/SaveEngine';

const spec = { firstName: 'Same', lastName: 'Again', gender: 'nonbinary' as const, background: 'Model' as const, archetype: 'Blockbuster Star' as const };

describe('Save/load determinism', () => {
  it('continuing from a load replays identically for 60 weeks', async () => {
    const save = new SaveEngine('test-db-determinism');
    const game = await Game.createAndSave({ player: spec, seed: 'det-load' }, save);
    for (let i = 0; i < 10; i++) { game.planAction({ type: 'rest' }); await game.endWeekAndPersist(); }
    const loaded = (await Game.load(save, game.state.universeId))!;
    for (let i = 0; i < 60; i++) {
      game.planAction({ type: 'rest' });
      loaded.planAction({ type: 'rest' });
      const a = game.endWeek();
      const b = loaded.endWeek();
      expect(b).toEqual(a);
    }
    expect(loaded.ws.movies.size).toBe(game.ws.movies.size);
    for (const [id, m] of game.ws.movies) expect(loaded.ws.movies.get(id)).toEqual(m);
    for (const [id, p] of game.ws.people) expect(loaded.ws.people.get(id)).toEqual(p);
    for (const [id, d] of game.ws.directors) expect(loaded.ws.directors.get(id)).toEqual(d);
    expect(loaded.state).toEqual(game.state);
    save.close();
  }, 60_000);
});
