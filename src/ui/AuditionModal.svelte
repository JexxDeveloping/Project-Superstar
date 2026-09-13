<script lang="ts">
  import { store } from './store.svelte';
  import { PREP_EFFECTS } from '../industry/AuditionEngine';
  import { formatMoney } from '../industry/BoxOfficeEngine';
  import { formatDate } from '../core/TimeEngine';
  import type { PrepChoice } from '../core/GameState';

  let { listingId }: { listingId: string } = $props();

  const s = $derived(store.state!);
  const app = $derived(s.applications.find((a) => a.listingId === listingId));
  const live = $derived(s.listings.find((l) => l.id === listingId));
  const movieForApp = $derived(app ? store.movie(app.movieId) : undefined);
  /** Once a film leaves casting its listing is gone; rebuild the view from the application + role. */
  const listing = $derived.by(() => {
    if (live) return live;
    if (!app || !movieForApp) return undefined;
    const role = movieForApp.roles.find((r) => r.id === app.roleId);
    const entry = movieForApp.cast.find((c) => c.personId === s.player.id);
    return {
      id: app.listingId, movieId: app.movieId, roleId: app.roleId, characterName: app.characterName, roleType: app.roleType,
      expectedSalary: entry?.salary ?? role?.salary ?? 0, difficulty: role?.difficulty ?? 0, requiredActing: role?.requiredActing ?? 0,
      preferredGenre: movieForApp.genres[0], estimatedPrestige: 'Moderate' as const, estimatedCommercial: 'Moderate' as const,
      competitorIds: (app.competitorScores ?? []).map((c) => c.personId), postedWeek: app.appliedWeek, expiresWeek: app.appliedWeek,
    };
  });
  const movie = $derived(listing ? store.movie(listing.movieId) : undefined);
  const director = $derived(movie ? store.director(movie.directorId) : undefined);
  const studio = $derived(movie ? store.studio(movie.studioId) : undefined);
  const competitors = $derived(listing ? listing.competitorIds.map((id) => store.person(id)).filter((p) => !!p) : []);
  const PREPS = Object.keys(PREP_EFFECTS) as PrepChoice[];

  function close() { store.openListingId = null; }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') close(); }} />

<div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) close(); }} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    {#if !listing || !movie}
      <p class="muted">This listing has closed.</p>
      <button onclick={close}>Close</button>
    {:else}
      <div class="row spread">
        <div>
          <h3>Audition — {movie.title}</h3>
          <h1>{listing.characterName} <span class="muted" style="font-weight:500">· {listing.roleType}</span></h1>
        </div>
        <button class="ghost" onclick={close}>✕</button>
      </div>

      <div class="grid grid-3" style="margin:14px 0">
        <div class="card"><div class="stat-label">Genre</div><div>{movie.genres.join(' / ')}</div></div>
        <div class="card"><div class="stat-label">Studio</div><div>{studio?.name}</div></div>
        <div class="card"><div class="stat-label">Budget</div><div class="mono">{formatMoney(movie.budget)} <span class="muted tiny">{movie.budgetTier}</span></div></div>
        <div class="card"><div class="stat-label">Director</div><div>{director?.firstName} {director?.lastName}</div></div>
        <div class="card"><div class="stat-label">Salary</div><div class="mono">{formatMoney(listing.expectedSalary)}</div></div>
        <div class="card"><div class="stat-label">Shoot</div><div>{formatDate(movie.productionStartWeek, s.epochYear)} · {movie.productionWeeks} wks</div></div>
      </div>

      {#if movie.cast.length > 0}
        <p class="muted small-text" style="margin-bottom:10px">Already cast: {movie.cast.slice().sort((a, b) => a.billing - b.billing).map((c) => `${store.personName(c.personId)} as ${c.characterName}`).join(' · ')}</p>
      {/if}
      <section class="panel">
        <div class="panel-head"><h3>Casting competition</h3></div>
        <table class="data">
          <thead><tr><th>Actor</th><th class="num">Acting</th><th class="num">Star</th>{#if app?.competitorScores}<th class="num">Read</th>{/if}</tr></thead>
          <tbody>
            <tr class="you"><td><strong>{s.player.firstName} {s.player.lastName}</strong> <span class="muted tiny">you</span></td><td class="num mono">{Math.round(s.player.attributes.acting)}</td><td class="num mono">{Math.round(s.player.attributes.starPower)}</td>{#if app?.competitorScores}<td class="num mono">{app.auditionScore}</td>{/if}</tr>
            {#each competitors as c}
              {@const sc = app?.competitorScores?.find((x) => x.personId === c.id)}
              <tr><td>{c.firstName} {c.lastName}</td><td class="num mono">{Math.round(c.attributes.acting)}</td><td class="num mono">{Math.round(c.attributes.starPower)}</td>{#if app?.competitorScores}<td class="num mono">{sc?.score ?? '—'}</td>{/if}</tr>
            {/each}
          </tbody>
        </table>
      </section>

      {#if app?.status === 'audition_pending'}
        <section class="panel">
          <div class="panel-head"><h3>Prepare for the room</h3><span class="muted tiny">Resolves when you end the week</span></div>
          <div class="preps">
            {#each PREPS as prep}
              {@const e = PREP_EFFECTS[prep]}
              <button class="prep" class:selected={app.prep === prep} onclick={() => store.choosePrep(listingId, prep)}>
                <div class="row spread"><strong>{prep}</strong><span class="tag {e.score >= 7 ? 'good' : e.score > 0 ? 'info' : ''}">+{e.score}</span></div>
                <div class="muted small-text">{e.blurb}</div>
                <div class="muted tiny">{e.energy ? `−${e.energy} energy` : 'no energy cost'}{e.cash ? ` · $${e.cash}` : ''}</div>
              </button>
            {/each}
          </div>
          {#if !app.prep}<p class="warn small-text" style="margin-top:8px">Pick a preparation — going in without one counts as "Do Nothing".</p>{/if}
        </section>
      {:else if app?.status === 'offer'}
        <section class="panel">
          <div class="panel-head"><h3>{app.source === 'direct' ? 'Direct offer' : 'Audition result'}</h3><span class="tag good">Offer</span></div>
          {#if app.source === 'direct'}
            <div class="stat-big">No audition</div>
            <p class="muted">{store.studio(movie.studioId)?.name} sent this part straight to you — a name doesn't read for the room.</p>
          {:else}
            <div class="stat-big">Score {app.auditionScore}/100</div>
            <p class="muted">"{app.directorReaction}"</p>
          {/if}
          <div class="card" style="margin-top:12px">
            <div class="row spread wrap">
              <div><strong>{listing.roleType}</strong> · opening at {formatMoney(app.contract?.terms.baseSalary ?? listing.expectedSalary)} · {movie.productionWeeks}-week shoot from {formatDate(movie.productionStartWeek, s.epochYear)}</div>
              <div class="row">
                <button class="danger ghost" onclick={() => { store.declineOffer(listingId); close(); }}>Decline</button>
                <button class="primary" onclick={() => store.openContract(listingId)}>Review the deal ▸</button>
              </div>
            </div>
            <div class="muted tiny" style="margin-top:6px">Offer lapses {formatDate(app.offerExpiresWeek!, s.epochYear)}.</div>
          </div>
        </section>
      {:else if app?.status === 'booked' || app?.status === 'in_production'}
        <section class="panel">
          <div class="panel-head"><h3>Booked</h3><span class="tag good">{app.status === 'booked' ? 'Awaiting shoot' : 'Filming'}</span></div>
          {#if app.source === 'direct'}
            <div class="stat-big">Direct offer</div>
            <p class="muted">Sent to you without an audition.</p>
          {:else}
            <div class="stat-big">Score {app.auditionScore}/100</div>
            <p class="muted">"{app.directorReaction}"</p>
          {/if}
          <p style="margin-top:8px">
            {#if app.status === 'booked'}
              Shoot begins {formatDate(movie.productionStartWeek, s.epochYear)} ({Math.max(0, movie.productionStartWeek - s.week)} week{movie.productionStartWeek - s.week === 1 ? '' : 's'} away) · {movie.productionWeeks} weeks · {formatMoney(listing.expectedSalary)} on wrap.
              {#if movie.holdWeeks}<span class="warn"> The production has pushed its start {movie.holdWeeks} week{movie.holdWeeks === 1 ? '' : 's'} waiting for you; it recasts after 6.</span>{/if}
            {:else}
              You're on set. See the Production screen for the shoot.
            {/if}
          </p>
        </section>
      {:else if app?.auditionScore !== undefined}
        <section class="panel">
          <div class="panel-head"><h3>Audition result</h3><span class="tag bad">{app.status === 'rejected' ? 'Passed over' : app.status}</span></div>
          <div class="stat-big">Score {app.auditionScore}/100</div>
          <p class="muted">"{app.directorReaction}"</p>
        </section>
      {:else if app?.status === 'applied'}
        <p class="muted">Application submitted. Casting responds after you end the week.</p>
      {:else if app?.status === 'no_callback'}
        <p class="muted">No callback. Casting went another way.</p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .you td { background: rgba(229, 184, 74, 0.06); }
  .preps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .prep { text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; }
  .prep.selected { border-color: var(--accent); background: rgba(229, 184, 74, 0.1); }
</style>
