<script lang="ts">
  import { store } from './store.svelte';

  let code = $state('');
  let error = $state<string | null>(null);

  function submit(): void {
    error = null;
    store.lastCheat = null;
    if (!code.trim()) return;
    store.applyCheat(code);
    if (!store.lastCheat) error = 'Unknown code.';
    else code = '';
  }
  function close(): void {
    store.settingsOpen = false;
    store.lastCheat = null;
  }
</script>

<div class="modal-backdrop" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
  <div class="modal settings" role="dialog" aria-modal="true">
    <div class="row spread" style="margin-bottom:12px">
      <h2>Settings</h2>
      <button class="small ghost" onclick={close}>Close</button>
    </div>

    <section class="card">
      <div class="stat-label">Codes</div>
      <p class="muted small-text" style="margin:6px 0 10px">Playtest codes. Enter one and press Apply.</p>
      <form class="row" onsubmit={(e) => { e.preventDefault(); submit(); }}>
        <input type="text" bind:value={code} placeholder="Enter code" autocomplete="off" spellcheck="false" style="flex:1" />
        <button class="primary small" type="submit" disabled={!code.trim()}>Apply</button>
      </form>
      {#if store.lastCheat}<p class="good small-text" style="margin-top:8px">Applied: {store.lastCheat}</p>{/if}
      {#if error}<p class="bad small-text" style="margin-top:8px">{error}</p>{/if}
    </section>
  </div>
</div>

<style>
  .settings { width: min(460px, 100%); }
</style>
