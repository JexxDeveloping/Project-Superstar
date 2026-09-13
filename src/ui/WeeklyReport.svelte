<script lang="ts">
  import type { TimelineEvent, TimelineCategory } from '../core/GameState';

  /** `collapseKey` makes the panel minimizable; the choice is remembered per browser under that key. */
  let { events, title = 'This week', collapseKey }: { events: TimelineEvent[]; title?: string; collapseKey?: string } = $props();

  const TAG: Record<TimelineCategory, string> = {
    time: '', training: 'info', audition: 'accent', casting: 'good', production: 'warn', release: 'info', box_office: 'accent', result: 'good', finance: 'bad', industry: '', contract: 'good', agent: 'info', news: 'accent',
  };
  const LABEL: Record<TimelineCategory, string> = {
    time: 'Time', training: 'Training', audition: 'Audition', casting: 'Casting', production: 'Production', release: 'Release', box_office: 'Box Office', result: 'Result', finance: 'Finance', industry: 'Industry', contract: 'Contract', agent: 'Agent', news: 'News',
  };

  let collapsed = $state(readCollapsed());
  function readCollapsed(): boolean {
    if (!collapseKey) return false;
    try { return localStorage.getItem(collapseKey) === '1'; } catch { return false; }
  }
  function toggle(): void {
    collapsed = !collapsed;
    if (!collapseKey) return;
    try { localStorage.setItem(collapseKey, collapsed ? '1' : '0'); } catch { /* private mode */ }
  }
</script>

<section class="panel">
  <div class="panel-head">
    {#if collapseKey}
      <button class="head-toggle" onclick={toggle} title={collapsed ? 'Expand' : 'Minimize'} aria-expanded={!collapsed}>
        <span class="chev" class:open={!collapsed}>▸</span><h3>{title}</h3>
      </button>
    {:else}
      <h3>{title}</h3>
    {/if}
    <span class="muted tiny">{events.length} event{events.length === 1 ? '' : 's'}</span>
  </div>
  {#if !collapsed}
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
  {/if}
</section>

<style>
  .event { display: grid; grid-template-columns: 92px 1fr; gap: 10px; align-items: start; }
  .event .tag { text-align: center; margin-top: 2px; }
  .ev-title { font-weight: 600; }
  .head-toggle { display: flex; align-items: center; gap: 8px; background: transparent; border: none; padding: 0; color: inherit; cursor: pointer; min-width: 0; }
  .head-toggle h3 { margin: 0; }
  .chev { display: inline-block; color: var(--muted); font-size: 18px; line-height: 1; transition: transform 0.15s; }
  .head-toggle:hover .chev { color: var(--text); }
  .chev.open { transform: rotate(90deg); }
</style>
