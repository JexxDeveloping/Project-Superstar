<script lang="ts">
  import { store } from './store.svelte';
  import { formatDate } from '../core/TimeEngine';
  import { ageInYears, starTier } from '../sim/ActorEngine';
  import { formatMoney } from '../industry/BoxOfficeEngine';

  const s = $derived(store.state!);
  const p = $derived(s.player);
  const attention = $derived(
    s.applications.some((a) => a.status === 'offer' || (a.status === 'audition_pending' && !a.prep)),
  );
</script>

<header class="topbar">
  <div class="identity">
    <div class="avatar">{p.firstName[0]}{p.lastName[0]}</div>
    <div>
      <div class="name">{p.firstName} {p.lastName}</div>
      <div class="muted tiny">Age {ageInYears(p, s.week)} · {starTier(p.attributes.starPower)} · Level {p.level}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><span class="stat-label">Overall</span><span class="stat-value">{Math.round(p.attributes.acting)}</span></div>
    <div class="stat"><span class="stat-label">Star Power</span><span class="stat-value">{Math.round(p.attributes.starPower)}</span></div>
    <div class="stat"><span class="stat-label">Cash</span><span class="stat-value" class:bad={p.cash < 0}>{formatMoney(p.cash)}</span></div>
    <div class="stat"><span class="stat-label">Energy</span><span class="stat-value" class:warn={p.energy < 40}>{Math.round(p.energy)}</span></div>
    <div class="stat"><span class="stat-label">Stress</span><span class="stat-value" class:warn={p.stress > 60}>{Math.round(p.stress)}</span></div>
  </div>

  <div class="date">
    <div class="date-main">{formatDate(s.week, s.epochYear)}</div>
    <div class="muted tiny">Actions left: {store.actionsRemaining}/{s.actionsPerWeek}{attention ? ' · needs your answer' : ''}</div>
  </div>

  <div class="row">
    <button onclick={() => store.skipToEvent()} disabled={store.busy} title="Advance weeks until something needs you">Skip to next event</button>
    <button class="primary" onclick={() => store.endWeek()} disabled={store.busy}>END WEEK ▸</button>
  </div>
</header>

<style>
  .topbar {
    display: flex; align-items: center; gap: 22px; padding: 10px 18px;
    background: var(--bg-2); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10;
  }
  .identity { display: flex; align-items: center; gap: 10px; min-width: 210px; }
  .avatar {
    width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; font-weight: 800;
    background: linear-gradient(135deg, #3b4657, #222a36); border: 1px solid var(--border); color: var(--accent);
  }
  .name { font-weight: 700; font-size: 15px; }
  .stats { display: flex; gap: 18px; flex: 1; }
  .stat { display: flex; flex-direction: column; }
  .stat-value { font-weight: 800; font-size: 16px; font-variant-numeric: tabular-nums; }
  .date { text-align: right; min-width: 210px; }
  .date-main { font-weight: 700; }
</style>
