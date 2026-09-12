<script lang="ts">
  import { store } from './store.svelte';
  import WeeklyReport from './WeeklyReport.svelte';
  import { formatDate } from '../core/TimeEngine';

  const s = $derived(store.state!);
  const weeks = $derived.by(() => {
    const byWeek = new Map<number, typeof s.timeline>();
    for (const e of s.timeline) {
      if (!byWeek.has(e.week)) byWeek.set(e.week, []);
      byWeek.get(e.week)!.push(e);
    }
    return [...byWeek.entries()].sort((a, b) => b[0] - a[0]).slice(0, 40);
  });
</script>

<div class="stack">
  <div class="row spread"><h2>Timeline</h2><span class="muted tiny">Most recent 40 weeks with activity</span></div>
  {#each weeks as [week, events] (week)}
    <WeeklyReport {events} title={formatDate(week, s.epochYear)} />
  {/each}
</div>
