<script lang="ts">
  import { store } from './store.svelte';
  import WeeklyReport from './WeeklyReport.svelte';
  import AgentPanel from './AgentPanel.svelte';
  import { describeTerms } from '../industry/ContractEngine';
  import { GENRES, type Genre, type PlannedAction } from '../core/GameState';
  import { formatDate } from '../core/TimeEngine';
  import { ACTION_COSTS, starTier } from '../sim/ActorEngine';
  import DayJobPanel from './DayJobPanel.svelte';
  import { formatMoney } from '../industry/BoxOfficeEngine';
  import { campaignBand } from '../world/ReleaseCalendarEngine';
  import { CAMPAIGN_LABEL } from './format';

  const s = $derived(store.state!);
  const p = $derived(s.player);
  let trainingGenre = $state<Genre>('Drama');

  const topGenres = $derived([...GENRES].sort((a, b) => p.genres[b] - p.genres[a]).slice(0, 5));
  const inFlight = $derived(s.applications.filter((a) => ['applied', 'audition_pending', 'offer', 'booked'].includes(a.status)));
  const offers = $derived(s.applications.filter((a) => a.status === 'offer' && a.contract));
  const releases = $derived(s.trackedMovieIds.map((id) => store.movie(id)).filter((m) => !!m));

  function label(a: PlannedAction): string {
    switch (a.type) {
      case 'rest': return 'Rest';
      case 'acting_class': return 'Acting class ($150)';
      case 'genre_training': return `${a.genre} training ($100)`;
      case 'prepare_role': return 'Prepare for role';
      case 'apply': { const l = s.listings.find((x) => x.id === a.listingId); return `Apply: ${l?.characterName ?? 'role'}`; }
      case 'read_script': { const l = s.listings.find((x) => x.id === a.listingId); return `Read script: ${l ? store.movie(l.movieId)?.title : 'film'}`; }
    }
  }
  const STATUS: Record<string, string> = {
    applied: 'Awaiting callback', audition_pending: 'Audition next week', offer: 'OFFER — answer now', booked: 'Booked — awaiting shoot',
  };
</script>

<div class="grid home">
  <div class="stack">
    <section class="panel">
      <div class="panel-head"><h3>Actor</h3><span class="tag accent">{starTier(p.attributes.starPower)}</span></div>
      <div class="portrait-row">
        <div class="portrait">{p.firstName[0]}{p.lastName[0]}</div>
        <div class="stack" style="flex:1">
          <div class="meter-row"><span>Acting</span><div class="meter"><span style="width:{p.attributes.acting}%"></span></div><b class="mono">{Math.round(p.attributes.acting)}</b></div>
          <div class="meter-row"><span>Star Power</span><div class="meter"><span style="width:{p.attributes.starPower}%"></span></div><b class="mono">{Math.round(p.attributes.starPower)}</b></div>
          <div class="meter-row"><span>Energy</span><div class="meter energy"><span style="width:{p.energy}%"></span></div><b class="mono">{Math.round(p.energy)}</b></div>
          <div class="meter-row"><span>Stress</span><div class="meter stress"><span style="width:{p.stress}%"></span></div><b class="mono">{Math.round(p.stress)}</b></div>
          <div class="meter-row"><span>Momentum</span><div class="meter"><span style="width:{Math.max(0, p.momentum)}%"></span></div><b class="mono">{Math.round(p.momentum)}</b></div>
        </div>
      </div>
      <div class="attrs">
        {#each [['Reputation', p.attributes.reputation], ['Critical Rep', p.attributes.criticalReputation], ['Connections', p.attributes.connections], ['Fans', p.attributes.fanPopularity], ['Charisma', p.attributes.charisma], ['Professionalism', p.attributes.professionalism]] as [k, v]}
          <div class="attr"><span class="stat-label">{k}</span><span class="mono">{Math.round(v as number)}</span></div>
        {/each}
      </div>
      <div class="genres">
        {#each topGenres as g}<span class="tag">{g} {Math.round(p.genres[g])}</span>{/each}
      </div>
      <div class="muted tiny" style="margin-top:8px">{p.background} · {p.archetype} · Earnings {formatMoney(p.careerEarnings)} · XP {p.xp}</div>
      <div class="muted tiny">Rent ${s.weeklyExpenses}/wk</div>
    </section>

    <section class="panel">
      <div class="panel-head"><h3>Week plan</h3><span class="muted tiny">{store.actionsRemaining} action{store.actionsRemaining === 1 ? '' : 's'} left</span></div>
      <div class="row wrap">
        <button class="small" onclick={() => store.plan({ type: 'rest' })} disabled={store.actionsRemaining === 0}>Rest <span class="muted">+{-ACTION_COSTS.rest.energy} energy</span></button>
        <button class="small" onclick={() => store.plan({ type: 'acting_class' })} disabled={store.actionsRemaining === 0}>Acting class <span class="muted">$150</span></button>
        <span class="row">
          <select bind:value={trainingGenre} class="small-select">{#each GENRES as g}<option value={g}>{g}</option>{/each}</select>
          <button class="small" onclick={() => store.plan({ type: 'genre_training', genre: trainingGenre })} disabled={store.actionsRemaining === 0}>Train genre <span class="muted">$100</span></button>
        </span>
        <button class="small" onclick={() => store.plan({ type: 'prepare_role' })} disabled={store.actionsRemaining === 0 || !(s.activeProduction || inFlight.some((a) => a.status === 'booked'))} title={s.activeProduction || inFlight.some((a) => a.status === 'booked') ? 'Deepen the work on your booked role' : 'Nothing to prepare for yet — book a role first'}>Prepare for role</button>
        <button class="small ghost" onclick={() => (store.screen = 'auditions')}>Apply to auditions ▸</button>
      </div>
      {#if s.weekPlan.length > 0}
        <div class="plan">
          {#each s.weekPlan as a, i}
            <span class="tag info plan-item">{label(a)} <button class="x" onclick={() => store.unplan(i)} title="Remove">×</button></span>
          {/each}
        </div>
      {:else}
        <p class="muted small-text" style="margin-top:8px">Nothing planned. Unplanned weeks still recover a little energy.</p>
      {/if}
    </section>

    <DayJobPanel />

  </div>

  <div class="stack">
    {#if offers.length > 0}
      <section class="panel offers">
        <div class="panel-head"><h3>{offers.length === 1 ? 'Offer on the table' : `${offers.length} offers on the table`}</h3><span class="muted tiny">{offers.length > 1 ? 'Shoots can\'t overlap — pick a direction' : 'Negotiate or sign'}</span></div>
        <div class="grid" style="grid-template-columns: repeat({Math.min(3, offers.length)}, minmax(0, 1fr))">
          {#each offers as o (o.listingId)}
            {@const m = store.movie(o.movieId)}
            {@const l = s.listings.find((x) => x.id === o.listingId)}
            <div class="card stack">
              <div><strong>{o.movieTitle}</strong> <span class="tag {o.source === 'direct' ? 'accent' : 'good'}">{o.source === 'direct' ? 'Direct offer' : 'Won in the room'}</span></div>
              <div class="muted small-text">{o.characterName} · {o.roleType} · {m?.genres.join(' / ')} · {m ? store.studio(m.studioId)?.name : ''}</div>
              <div class="mono" style="font-size:18px;font-weight:800">{formatMoney(o.contract!.terms.baseSalary)}</div>
              <div class="muted tiny">{describeTerms(o.contract!.terms).slice(1).join(' · ') || 'Flat fee'}</div>
              <div class="muted tiny">Budget {m ? formatMoney(m.budget) : ''} · Prestige {l?.estimatedPrestige ?? '?'} · Commercial {l?.estimatedCommercial ?? '?'} · Campaign {m ? CAMPAIGN_LABEL[campaignBand(m)] : '?'}</div>
              <div class="muted tiny">Shoot {m ? formatDate(m.productionStartWeek, s.epochYear) : ''} · {m?.productionWeeks} wks · lapses {o.offerExpiresWeek !== undefined ? formatDate(o.offerExpiresWeek, s.epochYear) : ''}</div>
              <div class="row" style="margin-top:4px">
                <button class="small danger ghost" onclick={() => store.declineOffer(o.listingId)}>Decline</button>
                <button class="small primary" onclick={() => store.openContract(o.listingId)}>Negotiate / sign ▸</button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <section class="panel">
      <div class="panel-head"><h3>Current project</h3></div>
      {#if s.activeProduction}
        {@const m = store.movie(s.activeProduction.movieId)}
        <div><strong>{m?.title}</strong> — {s.activeProduction.characterName} ({s.activeProduction.roleType})</div>
        <div class="muted small-text">Filming · Week {s.activeProduction.currentWeek} of {s.activeProduction.totalWeeks}</div>
        <div class="meter" style="margin-top:8px"><span style="width:{(100 * s.activeProduction.currentWeek) / s.activeProduction.totalWeeks}%"></span></div>
      {:else if inFlight.some((a) => a.status === 'booked')}
        {@const a = inFlight.find((x) => x.status === 'booked')!}
        {@const m = store.movie(a.movieId)}
        <div><strong>{m?.title ?? a.movieTitle}</strong> — {a.characterName} ({a.roleType})</div>
        <div class="muted small-text">Booked. Shoot begins {m ? formatDate(m.productionStartWeek, s.epochYear) : 'soon'}.</div>
      {:else}
        <p class="muted">No project. Hit the audition board.</p>
      {/if}
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Auditions in motion</h3><button class="small ghost" onclick={() => (store.screen = 'auditions')}>Board ▸</button></div>
      {#if inFlight.length === 0}
        <p class="muted">Nothing pending.</p>
      {:else}
        <table class="data">
          <thead><tr><th>Role</th><th>Movie</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {#each inFlight as a}
              <tr>
                <td>{a.characterName} <span class="muted tiny">{a.roleType}</span></td>
                <td>{a.movieTitle}</td>
                <td><span class="tag {a.status === 'offer' ? 'good' : a.status === 'audition_pending' && !a.prep ? 'warn' : ''}">{STATUS[a.status]}</span></td>
                <td class="right"><button class="small" onclick={() => (store.openListingId = a.listingId)}>Open</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    <section class="panel">
      <div class="panel-head"><h3>Your releases</h3><button class="small ghost" onclick={() => (store.screen = 'production')}>Details ▸</button></div>
      {#if releases.length === 0}
        <p class="muted">No films in post or in theaters.</p>
      {:else}
        <table class="data">
          <thead><tr><th>Movie</th><th>Status</th><th class="num">Worldwide</th></tr></thead>
          <tbody>
            {#each releases as m}
              <tr>
                <td>{m.title}</td>
                <td class="muted">{m.status === 'released' ? `In theaters · week ${m.boxOffice?.weeks.length ?? 0}` : m.status === 'post-production' ? `Opens ${formatDate(m.releaseWeek!, s.epochYear)}` : m.status}</td>
                <td class="num mono">{m.boxOffice ? formatMoney(m.boxOffice.worldwide) : '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
    <WeeklyReport events={s.weeklyReport} title="This week's events" collapseKey="weekly-report-collapsed" />

    <AgentPanel />
  </div>
</div>

<style>
  .home { grid-template-columns: 380px 1fr; align-items: start; }
  .portrait-row { display: flex; gap: 14px; align-items: flex-start; }
  .portrait { width: 72px; height: 72px; border-radius: 14px; display: grid; place-items: center; font-weight: 800; font-size: 22px; color: var(--accent); background: linear-gradient(135deg, #3b4657, #222a36); border: 1px solid var(--border); }
  .meter-row { display: grid; grid-template-columns: 78px 1fr 30px; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
  .meter-row b { color: var(--text); text-align: right; }
  .attrs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 10px; margin-top: 12px; }
  .attr { display: flex; justify-content: space-between; gap: 8px; background: var(--bg-2); border: 1px solid var(--border); border-radius: 8px; padding: 5px 8px; white-space: nowrap; }
  .genres { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .plan { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .plan-item { display: inline-flex; align-items: center; gap: 6px; text-transform: none; letter-spacing: 0; font-size: 12px; }
  .x { background: transparent; border: none; padding: 0 2px; color: inherit; font-size: 14px; line-height: 1; }
  .small-select { padding: 4px 8px; font-size: 12px; }
</style>
