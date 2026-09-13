<script lang="ts">
  import type { TableSort } from './sort.svelte';

  let { sort, key, label, num = false }: { sort: TableSort; key: string; label: string; num?: boolean } = $props();
  const active = $derived(sort.key === key);
</script>

<th class="sortable" class:num class:active onclick={() => sort.toggle(key)} title={active ? (sort.dir === 'asc' ? 'Sorted ascending — click for descending' : 'Sorted descending — click for ascending') : 'Click to sort'}>
  {label}<span class="arrow">{active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
</th>

<style>
  th.sortable { cursor: pointer; user-select: none; white-space: nowrap; }
  th.sortable:hover { color: var(--text); }
  th.sortable.active { color: var(--accent); }
  .arrow { display: inline-block; width: 12px; margin-left: 3px; font-size: 9px; }
</style>
