<script lang="ts">
  import { store } from './store.svelte';
  import { formatDate } from '../core/TimeEngine';
  import { formatMoney } from '../industry/BoxOfficeEngine';
  import { applyBlockedReason, readScriptBlockedReason } from '../industry/AuditionEngine';
  import { campaignBand } from '../world/ReleaseCalendarEngine';
  import { CAMPAIGN_LABEL } from './format';

  const s = $derived(store.state!);
  const history = $derived(s.applications.filter((a) => !['applied', 'audition_pending', 'offer', 'booked'].includes(a.status)).slice().reverse());

  const STATUS: Record<string, [string, string]> = {
    applied: ['Awaiting callback', 'info'], no_callback: ['No callback', 'bad'], audition_pending: ['Audition next week', 'warn'],
    offer: ['Offer', 'good'], rejected: ['Passed over', 'bad'], booked: ['Booked', 'good'], in_production: ['Filmed', ''], declined: ['Declined', ''], expired: ['Expired', ''],
  };
</script>

<div class="stack">
  <section class="panel">
    <div class="panel-head"><h2>Casting calls</h2><span class="muted tiny">{s.listings.length} open · applying costs 1 action</span></div>
    <div class="table-wrap">
    <table class="data">
      <thead>
        <tr><th>Movie</th><th>Genre</th><th class="num">Budget</th><th>Role</th><th>Director</th><th>Cast so far</th><th class="num">Salary</th><th class="num">Diff. / Req.</th><th>Prestige</th><th>Commercial</th><th>Marketing</th><th>Shoot</th><th></th></tr>
      </thead>
      <tbody>
        {#each s.listings as l (l.id)}
          {@const m = store.movie(l.movieId)}
          {@const d = m ? store.director(m.directorId) : undefined}
          {@const app = s.applications.find((a) => a.listingId === l.id)}
          {@const blocked = store.world ? applyBlockedReason(s, store.world, l.id) : 'Loading'}
          <tr>
            <td><strong>{m?.title}</strong><div class="muted tiny">{m ? store.studio(m.studioId)?.name : ''} · {m?.budgetTier}</div></td>
            <td>{m?.genres.join(' / ')}</td>
            <td class="num mono">{m ? formatMoney(m.budget) : ''}</td>
            <td>{l.characterName}<div class="muted tiny">{l.roleType} · {l.preferredGenre}</div></td>
            <td>{d ? `${d.firstName} ${d.lastName}` : ''}</td>
            <td class="muted tiny">{m && m.cast.length ? m.cast.slice(0, 2).map((c) => store.personName(c.personId)).join(', ') + (m.cast.length > 2 ? ` +${m.cast.length - 2}` : '') : 'Casting'}</td>
            <td class="num mono">{formatMoney(l.expectedSalary)}</td>
            <td class="num mono">{l.difficulty} / <span class:bad={s.player.attributes.acting < l.requiredActing}>{l.requiredActing}</span></td>
            <td class="muted">{l.estimatedPrestige}{#if l.scriptRead}<span class="good"> ✓</span>{/if}</td>
            <td class="muted">{l.estimatedCommercial}{#if l.scriptRead}<span class="good"> ✓</span>{/if}</td>
            <td class="muted" title="How big a marketing push the studio has committed to — whether the film will open">{m ? CAMPAIGN_LABEL[campaignBand(m)] : ''}</td>
            <td class="muted tiny">{m ? formatDate(m.productionStartWeek, s.epochYear) : ''}<br />{m?.productionWeeks} wks</td>
            <td class="right">
              {#if !l.scriptRead}
                {@const rb = readScriptBlockedReason(s, l.id)}
                <button class="small ghost" title={rb ?? 'Read the script (1 action): exact bands + a small edge in the room'} disabled={!!rb || store.actionsRemaining === 0} onclick={() => store.plan({ type: 'read_script', listingId: l.id })}>Read script</button>
              {/if}
              {#if app}
                <button class="small" onclick={() => (store.openListingId = l.id)}><span class="tag {STATUS[app.status][1]}">{STATUS[app.status][0]}</span></button>
              {:else if s.weekPlan.some((a) => a.type === 'apply' && a.listingId === l.id)}
                <span class="tag info">Planned</span>
              {:else}
                <button class="small primary" title={blocked ?? 'Apply (1 action)'} disabled={!!blocked || store.actionsRemaining === 0} onclick={() => store.plan({ type: 'apply', listingId: l.id })}>Apply</button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
  </section>

  {#if history.length > 0}
    <section class="panel">
      <div class="panel-head"><h3>Past applications</h3></div>
      <table class="data">
        <thead><tr><th>Week</th><th>Movie</th><th>Role</th><th>Outcome</th><th class="num">Score</th><th>Room</th></tr></thead>
        <tbody>
          {#each history as a}
            <tr>
              <td class="muted">{formatDate(a.appliedWeek, s.epochYear)}</td>
              <td><strong>{a.movieTitle}</strong></td>
              <td>{a.characterName} <span class="muted tiny">{a.roleType}</span></td>
              <td><span class="tag {STATUS[a.status][1]}">{STATUS[a.status][0]}</span></td>
              <td class="num mono">{a.auditionScore ?? '—'}</td>
              <td class="muted small-text">{a.directorReaction ?? ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}
</div>
