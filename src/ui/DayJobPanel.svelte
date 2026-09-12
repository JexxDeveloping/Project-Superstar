<script lang="ts">
  import { store } from './store.svelte';
  import { DAY_JOBS, dayJobById } from '../sim/ActorEngine';

  const s = $derived(store.state!);
  const job = $derived(dayJobById(s.dayJob));
  const onHold = $derived(!!s.activeProduction);
  let showOptions = $state(false);
</script>

<section class="panel">
  <div class="panel-head"><h3>Day job</h3>
    {#if job}<button class="small ghost" onclick={() => (showOptions = !showOptions)}>{showOptions ? 'Hide options' : 'Switch ▸'}</button>{/if}
  </div>
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
</section>

<style>
  .jobs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .job { text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; }
  .job.selected { border-color: var(--accent); }
</style>
