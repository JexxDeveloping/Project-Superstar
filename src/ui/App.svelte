<script lang="ts">
  import { onMount } from 'svelte';
  import { store, type Screen } from './store.svelte';
  import TopBar from './TopBar.svelte';
  import NewGame from './NewGame.svelte';
  import Home from './Home.svelte';
  import Auditions from './Auditions.svelte';
  import AuditionModal from './AuditionModal.svelte';
  import Production from './Production.svelte';
  import Career from './Career.svelte';
  import Timeline from './Timeline.svelte';
  import Industry from './Industry.svelte';
  import Scripts from './Scripts.svelte';
  import ContractModal from './ContractModal.svelte';
  import ResultScreen from './ResultScreen.svelte';

  const NAV: { id: Screen; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'auditions', label: 'Auditions' },
    { id: 'scripts', label: 'Scripts' },
    { id: 'production', label: 'Production' },
    { id: 'career', label: 'Career' },
    { id: 'industry', label: 'Industry' },
    { id: 'timeline', label: 'Timeline' },
  ];

  onMount(() => { void store.init(); });

  const badge = $derived.by(() => {
    const s = store.state;
    if (!s) return 0;
    return s.applications.filter((a) => a.status === 'offer' || (a.status === 'audition_pending' && !a.prep)).length;
  });
</script>

{#if !store.state}
  <NewGame />
{:else}
  <div class="shell">
    <TopBar />
    <div class="body">
      <nav class="sidebar">
        {#each NAV as n}
          <button class="nav" class:active={store.screen === n.id} onclick={() => (store.screen = n.id)}>
            {n.label}
            {#if n.id === 'auditions' && badge > 0}<span class="badge">{badge}</span>{/if}
          </button>
        {/each}
        <div class="spacer"></div>
        <button class="nav ghost" onclick={() => store.quitToMenu()}>Save & quit</button>
      </nav>
      <main class="main">
        {#if store.screen === 'home'}<Home />
        {:else if store.screen === 'auditions'}<Auditions />
        {:else if store.screen === 'scripts'}<Scripts />
        {:else if store.screen === 'production'}<Production />
        {:else if store.screen === 'career'}<Career />
        {:else if store.screen === 'industry'}<Industry />
        {:else}<Timeline />{/if}
      </main>
    </div>
  </div>

  {#if store.state.pendingResults.length > 0}
    <ResultScreen result={store.state.pendingResults[0]} />
  {:else if store.openContractListingId}
    <ContractModal listingId={store.openContractListingId} />
  {:else if store.openListingId}
    <AuditionModal listingId={store.openListingId} />
  {/if}
{/if}

{#if store.error}
  <div class="toast">{store.error}</div>
{/if}

<style>
  .shell { display: flex; flex-direction: column; height: 100%; }
  .body { display: flex; flex: 1; min-height: 0; }
  .sidebar { width: 170px; display: flex; flex-direction: column; gap: 4px; padding: 14px 10px; background: var(--bg-2); border-right: 1px solid var(--border); }
  .nav { text-align: left; background: transparent; border-color: transparent; text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; font-weight: 700; color: var(--muted); display: flex; justify-content: space-between; align-items: center; }
  .nav:hover { color: var(--text); }
  .nav.active { background: var(--panel-2); border-color: var(--border); color: var(--accent); }
  .badge { background: var(--accent); color: #1a1408; border-radius: 999px; padding: 0 7px; font-size: 11px; }
  .spacer { flex: 1; }
  .main { flex: 1; overflow: auto; padding: 18px 22px; }
</style>
