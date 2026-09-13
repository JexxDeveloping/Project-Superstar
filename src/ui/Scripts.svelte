<script lang="ts">
  import { store } from './store.svelte';
  import { readScriptBlockedReason } from '../industry/AuditionEngine';
  import { formatMoney } from '../industry/BoxOfficeEngine';
  import { formatDate } from '../core/TimeEngine';
  import { campaignBand } from '../world/ReleaseCalendarEngine';
  import { CAMPAIGN_LABEL } from './format';

  const s = $derived(store.state!);
  const listings = $derived(s.listings.slice().sort((a, b) => Number(!!a.scriptRead) - Number(!!b.scriptRead)));
</script>

<div class="stack">
  <section class="panel">
    <div class="panel-head"><h2>Scripts</h2><span class="muted tiny">Reading costs 1 action · sharpens the fuzzy bands to near-exact · small edge in the room</span></div>
    <p class="muted small-text" style="margin-bottom:10px">Prestige and Commercial on the board are estimates — how wide they are depends on how well connected you are. Reading a script tells you what the film actually is before you commit an audition, a contract, or a year of your career to it.</p>
    {#if listings.length === 0}
      <p class="muted">No open casting calls to read for.</p>
    {:else}
      <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Movie</th><th>Role</th><th class="num">Budget</th><th>Prestige</th><th>Commercial</th><th>Marketing</th><th>Shoot</th><th></th></tr></thead>
        <tbody>
          {#each listings as l (l.id)}
            {@const m = store.movie(l.movieId)}
            {@const rb = readScriptBlockedReason(s, l.id)}
            {@const planned = s.weekPlan.some((a) => a.type === 'read_script' && a.listingId === l.id)}
            <tr>
              <td><strong>{m?.title}</strong><div class="muted tiny">{m?.genres.join(' / ')} · {m ? store.studio(m.studioId)?.name : ''}</div></td>
              <td>{l.characterName}<div class="muted tiny">{l.roleType}</div></td>
              <td class="num mono">{m ? formatMoney(m.budget) : ''}</td>
              <td class={l.scriptRead ? 'good' : 'muted'}>{l.estimatedPrestige}{#if l.scriptRead} ✓{/if}</td>
              <td class={l.scriptRead ? 'good' : 'muted'}>{l.estimatedCommercial}{#if l.scriptRead} ✓{/if}</td>
              <td class="muted">{m ? CAMPAIGN_LABEL[campaignBand(m)] : ''}</td>
              <td class="muted tiny">{m ? formatDate(m.productionStartWeek, s.epochYear) : ''}</td>
              <td class="right">
                {#if l.scriptRead}<span class="tag good">Read</span>
                {:else if planned}<span class="tag info">Planned</span>
                {:else}<button class="small primary" disabled={!!rb || store.actionsRemaining === 0} title={rb ?? ''} onclick={() => store.plan({ type: 'read_script', listingId: l.id })}>Read script</button>{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      </div>
    {/if}
  </section>
</div>
