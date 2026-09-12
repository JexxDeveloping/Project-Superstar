<script lang="ts">
  import { store } from './store.svelte';
  import { LEVEL_LABEL, hireBlockedReason } from '../world/AgentEngine';
  import { formatMoney } from '../industry/BoxOfficeEngine';

  const s = $derived(store.state!);
  const agent = $derived(store.agent());
  const approaches = $derived(s.agentApproaches.map((id) => s.agents.find((a) => a.id === id)).filter((a) => !!a));
  let showRoster = $state(false);
  const roster = $derived(s.agents.slice().sort((a, b) => a.level - b.level || a.agency.localeCompare(b.agency)));
</script>

<section class="panel">
  <div class="panel-head"><h3>Representation</h3>
    <button class="small ghost" onclick={() => (showRoster = !showRoster)}>{showRoster ? 'Hide agencies' : 'Find an agent ▸'}</button>
  </div>
  {#if agent}
    <div class="row spread wrap">
      <div>
        <div><strong>{agent.firstName} {agent.lastName}</strong> · {agent.agency} <span class="tag info">{LEVEL_LABEL[agent.level]}</span></div>
        <div class="muted tiny">Connections {Math.round(agent.connections)} · Negotiation {Math.round(agent.negotiation)} · {Math.round(agent.commission * 100)}% commission · {agent.specialization === 'general' ? 'all genres' : `${agent.specialization} specialist`}</div>
        <div class="muted tiny">Backend earned to date: {formatMoney(s.player.backendEarnings)}</div>
      </div>
      <button class="small danger ghost" onclick={() => store.fireAgent()}>Part ways</button>
    </div>
  {:else}
    <p class="muted">No agent. You hear about fewer rooms, negotiate alone, and read studios by gut.</p>
  {/if}

  {#if approaches.length > 0}
    <div class="stack" style="margin-top:10px">
      {#each approaches as a (a.id)}
        <div class="card row spread wrap approach">
          <div>
            <div><strong>{a.firstName} {a.lastName}</strong> of {a.agency} wants to sign you <span class="tag accent">{LEVEL_LABEL[a.level]}</span></div>
            <div class="muted tiny">Connections {Math.round(a.connections)} · Negotiation {Math.round(a.negotiation)} · {Math.round(a.commission * 100)}% commission</div>
          </div>
          <div class="row">
            <button class="small ghost" onclick={() => store.declineApproach(a.id)}>Pass</button>
            <button class="small primary" onclick={() => store.hireAgent(a.id)}>Sign</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if showRoster}
    <table class="data" style="margin-top:10px">
      <thead><tr><th>Agent</th><th>Agency</th><th class="num">Conn.</th><th class="num">Nego.</th><th class="num">Cut</th><th></th></tr></thead>
      <tbody>
        {#each roster as a (a.id)}
          {@const reason = hireBlockedReason(s.player, a, s.agentApproaches.includes(a.id))}
          <tr>
            <td>{a.firstName} {a.lastName}<div class="muted tiny">{a.specialization === 'general' ? 'general' : a.specialization}</div></td>
            <td>{a.agency}<div class="muted tiny">{LEVEL_LABEL[a.level]} · min star {a.minStarPower}</div></td>
            <td class="num mono">{Math.round(a.connections)}</td>
            <td class="num mono">{Math.round(a.negotiation)}</td>
            <td class="num mono">{Math.round(a.commission * 100)}%</td>
            <td class="right">
              {#if a.id === s.player.agentId}<span class="tag good">Yours</span>
              {:else}<button class="small" disabled={!!reason} title={reason ?? 'Sign with this agency'} onclick={() => store.hireAgent(a.id)}>{reason ? 'Won\'t sign you' : 'Sign'}</button>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
  .approach { border-color: var(--accent); }
</style>
