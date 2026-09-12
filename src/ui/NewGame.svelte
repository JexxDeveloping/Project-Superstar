<script lang="ts">
  import { store } from './store.svelte';
  import type { Archetype, Background, Gender } from '../core/GameState';
  import { formatDate } from '../core/TimeEngine';
  import { EPOCH_YEAR } from '../core/Game';

  const BACKGROUNDS: Background[] = ['Film Student', 'Theater Actor', 'Child Actor', 'Model', 'Comedian', 'Social Media Personality', 'Athlete', 'Complete Unknown'];
  const ARCHETYPES: Archetype[] = ['Jack of All Trades', 'Action Hero', 'Dramatic Performer', 'Comedian', 'Romantic Lead', 'Method Actor', 'Character Actor', 'Blockbuster Star', 'Indie Darling'];

  let firstName = $state('Clyde');
  let lastName = $state('Osborne');
  let gender = $state<Gender>('male');
  let background = $state<Background>('Film Student');
  let archetype = $state<Archetype>('Jack of All Trades');
  let seed = $state(`career-${Date.now().toString(36)}`);

  function start() {
    store.newGame({ player: { firstName: firstName.trim() || 'Clyde', lastName: lastName.trim() || 'Osborne', gender, background, archetype }, seed: seed.trim() || 'default' });
  }
</script>

<div class="wrap">
  <div class="hero">
    <h1>Actor Career Simulator</h1>
    <p class="muted">One actor. A living industry. Fifty-five years to make a name — or not.</p>
  </div>

  <div class="grid grid-2 layout">
    <section class="panel">
      <div class="panel-head"><h2>New career</h2><span class="tag accent">Starts age 20</span></div>
      <div class="stack">
        <label class="field"><span>First name</span><input bind:value={firstName} /></label>
        <label class="field"><span>Last name</span><input bind:value={lastName} /></label>
        <label class="field"><span>Gender</span>
          <select bind:value={gender}><option value="male">Male</option><option value="female">Female</option><option value="nonbinary">Non-binary</option></select>
        </label>
        <label class="field"><span>Background</span>
          <select bind:value={background}>{#each BACKGROUNDS as b}<option value={b}>{b}</option>{/each}</select>
        </label>
        <label class="field"><span>Archetype</span>
          <select bind:value={archetype}>{#each ARCHETYPES as a}<option value={a}>{a}</option>{/each}</select>
        </label>
        <label class="field"><span>World seed</span><input bind:value={seed} /></label>
        <p class="muted small-text">Same seed + same choices replay the same universe.</p>
        <button class="primary" onclick={start} disabled={store.busy}>Begin — {formatDate(8, EPOCH_YEAR)}</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Continue</h2></div>
      {#if store.saves.length === 0}
        <p class="muted">No saved careers yet.</p>
      {:else}
        <div class="stack">
          {#each store.saves as save (save.universeId)}
            <div class="card row spread">
              <div>
                <div><strong>{save.playerName}</strong> {#if !save.compatible}<span class="tag bad">v{save.saveVersion} — incompatible</span>{/if}</div>
                <div class="muted tiny">{formatDate(save.week, EPOCH_YEAR)} · saved {new Date(save.savedAt).toLocaleString()}</div>
              </div>
              <div class="row">
                <button class="small danger ghost" onclick={() => store.deleteSave(save.universeId)} disabled={store.busy}>Delete</button>
                <button class="small primary" onclick={() => store.loadGame(save.universeId)} disabled={store.busy || !save.compatible}>Load</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  .wrap { max-width: 980px; margin: 0 auto; padding: 48px 24px; }
  .hero { margin-bottom: 26px; }
  .hero h1 { font-size: 30px; }
  .layout { align-items: start; }
  .field { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 10px; }
  .field span { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
</style>
