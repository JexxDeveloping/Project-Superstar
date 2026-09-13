<script lang="ts">
  import { store } from './store.svelte';
  import { DAY_JOBS, dayJobById } from '../sim/ActorEngine';

  const s = $derived(store.state!);
  const job = $derived(dayJobById(s.dayJob));
  const onHold = $derived(!!s.activeProduction);
  let showOptions = $state(false);
  /** Collapsed state is a per-browser convenience, remembered between sessions. */
  let collapsed = $state(readCollapsed());

  function readCollapsed(): boolean {
    try { return localStorage.getItem('dayjob-collapsed') === '1'; } catch { return false; }
  }
  function toggle(): void {
    collapsed = !collapsed;
    try { localStorage.setItem('dayjob-collapsed', collapsed ? '1' : '0'); } catch { /* private mode */ }
  }
</script>

<section class="panel">
  <div class="panel-head">
    <button class="head-toggle" onclick={toggle} title={collapsed ? 'Expand' : 'Minimize'} aria-expanded={!collapsed}>
      <span class="chev" class:open={!collapsed}>▸</span><h3>Day job</h3>
      {#if collapsed}<span class="muted tiny summary">{job ? `${job.name} · ${onHold ? 'on hold' : `+$${job.pay - s.weeklyExpenses}/wk after rent`}` : `none · rent $${s.weeklyExpenses}/wk`}</span>{/if}
    </button>
    {#if job && !collapsed}<button class="small ghost" onclick={() => (showOptions = !showOptions)}>{showOptions ? 'Hide options' : 'Switch ▸'}</button>{/if}
  </div>
  {#if !collapsed}
    {#if job}
      <div class="row spread wrap">
        <div>
          <div><strong>{job.name}</strong> {#if onHold}<span class="tag warn">On hold — you're on a set</span>{:else}<span class="tag good">+${job.pay - s.weeklyExpenses}/wk after rent</span>{/if}</div>
          <div class="muted tiny">${job.pay}/week · −{job.energy} energy · rent ${s.weeklyExpenses}/week</div>
        </div>
        <button class="small danger ghost" onclick={() => store.quitDayJob()}>Quit</button>
      </div>
    {:else}
      <p class="muted">No day job. Rent is ${s.weeklyExpenses}/week with nothing coming in between shoots.</p>
    {/if}

    {#if !job || showOptions}
      <div class="jobs" style="margin-top:10px">
        {#each DAY_JOBS as j (j.id)}
          <button class="job" class:selected={j.id === s.dayJob} disabled={j.id === s.dayJob} onclick={() => { store.takeDayJob(j.id); showOptions = false; }}>
            <div class="row spread"><strong>{j.name}</strong><span class="mono">${j.pay}/wk</span></div>
            <div class="muted tiny">−{j.energy} energy · +{j.stress} stress · nets +${j.pay - s.weeklyExpenses}/wk after rent</div>
            <div class="muted small-text">{j.blurb}</div>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  .head-toggle { display: flex; align-items: center; gap: 8px; background: transparent; border: none; padding: 0; color: inherit; cursor: pointer; min-width: 0; }
  .head-toggle h3 { margin: 0; }
  .chev { display: inline-block; color: var(--muted); font-size: 18px; line-height: 1; transition: transform 0.15s; }
  .head-toggle:hover .chev { color: var(--text); }
  .chev.open { transform: rotate(90deg); }
  .summary { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* One job per row: the panel lives in a 380px column and three cards side by side spilled into the next column. */
  .jobs { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .job { text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; width: 100%; min-width: 0; }
  .job.selected { border-color: var(--accent); }
</style>
