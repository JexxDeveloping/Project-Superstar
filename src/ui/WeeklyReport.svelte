<script lang="ts">
  import type { TimelineEvent, TimelineCategory } from '../core/GameState';

  let { events, title = 'This week' }: { events: TimelineEvent[]; title?: string } = $props();

  const TAG: Record<TimelineCategory, string> = {
    time: '', training: 'info', audition: 'accent', casting: 'good', production: 'warn', release: 'info', box_office: 'accent', result: 'good', finance: 'bad', industry: '',
  };
  const LABEL: Record<TimelineCategory, string> = {
    time: 'Time', training: 'Training', audition: 'Audition', casting: 'Casting', production: 'Production', release: 'Release', box_office: 'Box Office', result: 'Result', finance: 'Finance', industry: 'Industry',
  };
</script>

<section class="panel">
  <div class="panel-head"><h3>{title}</h3><span class="muted tiny">{events.length} event{events.length === 1 ? '' : 's'}</span></div>
  {#if events.length === 0}
    <p class="muted">Nothing to report.</p>
  {:else}
    <div class="stack">
      {#each events as e}
        <div class="event">
          <span class="tag {TAG[e.category]}">{LABEL[e.category]}</span>
          <div>
            <div class="ev-title">{e.title}</div>
            {#if e.description}<div class="muted small-text">{e.description}</div>{/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .event { display: grid; grid-template-columns: 92px 1fr; gap: 10px; align-items: start; }
  .event .tag { text-align: center; margin-top: 2px; }
  .ev-title { font-weight: 600; }
</style>
