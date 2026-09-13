<script lang="ts">
  import { store } from './store.svelte';
  import { formatDate } from '../core/TimeEngine';
  import { formatMoney } from '../industry/BoxOfficeEngine';
  import { applyBlockedReason, readScriptBlockedReason } from '../industry/AuditionEngine';
  import { campaignBand } from '../world/ReleaseCalendarEngine';
  import { CAMPAIGN_LABEL, bandRank } from './format';
  import { TableSort } from './sort.svelte';
  import SortTh from './SortTh.svelte';
  import type { AuditionListing } from '../core/GameState';

  const s = $derived(store.state!);
  const sort = new TableSort();
  const COLS = {
    movie: (l: AuditionListing) => store.movie(l.movieId)?.title,
    genre: (l: AuditionListing) => store.movie(l.movieId)?.genres[0],
    budget: (l: AuditionListing) => store.movie(l.movieId)?.budget,
    role: (l: AuditionListing) => l.characterName,
    director: (l: AuditionListing) => { const m = store.movie(l.movieId); const d = m ? store.director(m.directorId) : undefined; return d ? `${d.lastName} ${d.firstName}` : undefined; },
    cast: (l: AuditionListing) => store.movie(l.movieId)?.cast.length,
    salary: (l: AuditionListing) => l.expectedSalary,
    difficulty: (l: AuditionListing) => l.difficulty,
    prestige: (l: AuditionListing) => bandRank(l.estimatedPrestige),
    commercial: (l: AuditionListing) => bandRank(l.estimatedCommercial),
    marketing: (l: AuditionListing) => { const m = store.movie(l.movieId); return m ? ['minimal', 'modest', 'heavy'].indexOf(campaignBand(m)) : undefined; },
    shoot: (l: AuditionListing) => store.movie(l.movieId)?.productionStartWeek,
  };
  const listings = $derived(sort.apply(s.listings, COLS));

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
        <tr>
          <SortTh {sort} key="movie" label="Movie" /><SortTh {sort} key="genre" label="Genre" /><SortTh {sort} key="budget" label="Budget" num /><SortTh {sort} key="role" label="Role" /><SortTh {sort} key="director" label="Director" /><SortTh {sort} key="cast" label="Cast so far" /><SortTh {sort} key="salary" label="Salary" num /><SortTh {sort} key="difficulty" label="Diff. / Req." num /><SortTh {sort} key="prestige" label="Prestige" /><SortTh {sort} key="commercial" label="Commercial" /><SortTh {sort} key="marketing" label="Marketing" /><SortTh {sort} key="shoot" label="Shoot" /><th></th>
        </tr>
      </thead>
      <tbody>
        {#each listings as l (l.id)}
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

</div>
