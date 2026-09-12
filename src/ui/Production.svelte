<script lang="ts">
  import { store } from './store.svelte';
  import Chart from './Chart.svelte';
  import { boxOfficeOption } from './charts';
  import { formatDate } from '../core/TimeEngine';
  import { formatMoney, weekOverWeek } from '../industry/BoxOfficeEngine';
  import { PREP_ROLE_CAP } from '../sim/ActorEngine';
  import type { Movie } from '../core/GameState';

  const s = $derived(store.state!);
  const prod = $derived(s.activeProduction);
  const prodMovie = $derived(prod ? store.movie(prod.movieId) : undefined);
  const tracked = $derived(
    s.trackedMovieIds.map((id) => store.movie(id)).filter((m): m is Movie => !!m && m.status !== 'filming' && m.status !== 'pre-production'),
  );
</script>

<div class="stack">
  <section class="panel">
    <div class="panel-head"><h2>Production</h2>{#if prod}<span class="tag warn">Filming</span>{/if}</div>
    {#if prod && prodMovie}
      <div class="row spread wrap">
        <div>
          <h1>{prodMovie.title}</h1>
          <div class="muted">{prod.characterName} · {prod.roleType} · {store.studio(prodMovie.studioId)?.name} · dir. {store.director(prodMovie.directorId)?.firstName} {store.director(prodMovie.directorId)?.lastName}</div>
        </div>
        <div class="right">
          <div class="stat-big">Week {prod.currentWeek} of {prod.totalWeeks}</div>
          <div class="muted tiny">Salary {formatMoney(prod.salary)} on wrap · Prep {prod.prepBonus}/{PREP_ROLE_CAP}</div>
        </div>
      </div>
      <div class="meter" style="margin:10px 0"><span style="width:{(100 * prod.currentWeek) / prod.totalWeeks}%"></span></div>
      <p class="muted small-text">Use <em>Prepare for role</em> on the Home screen to deepen the work between shooting weeks.</p>
      <h3 style="margin-top:14px">On-set log</h3>
      {#if prod.events.length === 0}
        <p class="muted">Nothing notable yet.</p>
      {:else}
        <table class="data">
          <thead><tr><th>Week</th><th>Event</th><th></th></tr></thead>
          <tbody>
            {#each prod.events as e}
              <tr>
                <td class="muted">{e.week}</td>
                <td><strong>{e.title}</strong><div class="muted small-text">{e.description}</div></td>
                <td class="right">
                  {#if e.performanceMod}<span class="tag {e.performanceMod > 0 ? 'good' : 'bad'}">You {e.performanceMod > 0 ? '+' : ''}{e.performanceMod}</span>{/if}
                  {#if e.qualityMod}<span class="tag {e.qualityMod > 0 ? 'good' : 'bad'}">Film {e.qualityMod > 0 ? '+' : ''}{e.qualityMod}</span>{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {:else}
      <p class="muted">Not filming. Booked roles start shooting on their scheduled week.</p>
    {/if}
  </section>

  {#each tracked as m (m.id)}
    <section class="panel">
      <div class="panel-head">
        <div><h2>{m.title}</h2><div class="muted tiny">{m.genres.join(' / ')} · {store.studio(m.studioId)?.name} · Budget {formatMoney(m.budget)}</div></div>
        <span class="tag {m.status === 'released' ? 'accent' : 'info'}">{m.status === 'released' ? 'In theaters' : 'Post-production'}</span>
      </div>
      {#if m.status === 'post-production'}
        <p class="muted">Editing, scoring, marketing. Opens {formatDate(m.releaseWeek!, s.epochYear)}. Your performance and the film's quality are locked — the world sees them on release.</p>
      {:else if m.boxOffice}
        <div class="grid grid-3" style="margin-bottom:12px">
          <div class="card"><div class="stat-label">Opening (WW)</div><div class="stat-big mono">{formatMoney(m.boxOffice.openingDomestic + m.boxOffice.openingInternational)}</div></div>
          <div class="card"><div class="stat-label">Worldwide to date</div><div class="stat-big mono">{formatMoney(m.boxOffice.worldwide)}</div></div>
          <div class="card"><div class="stat-label">Reception</div><div class="stat-big">{m.quality?.criticScore}% <span class="muted" style="font-size:14px">critics</span> · {m.quality?.audienceScore}% <span class="muted" style="font-size:14px">audience</span></div></div>
        </div>
        <Chart option={boxOfficeOption(m.boxOffice)} height={200} />
        <table class="data" style="margin-top:10px">
          <thead><tr><th>Week</th><th class="num">Domestic</th><th class="num">Change</th><th class="num">International</th><th class="num">Week total</th></tr></thead>
          <tbody>
            {#each m.boxOffice.weeks as w, i}
              {@const wow = weekOverWeek(m.boxOffice, i)}
              <tr>
                <td class="muted">Week {i + 1}</td>
                <td class="num mono">{formatMoney(w.domestic)}</td>
                <td class="num mono" class:good={wow !== null && wow >= 0} class:bad={wow !== null && wow < -0.55}>{wow === null ? '—' : `${wow >= 0 ? '+' : ''}${Math.round(wow * 100)}%`}</td>
                <td class="num mono">{formatMoney(w.international)}</td>
                <td class="num mono">{formatMoney(w.domestic + w.international)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
  {/each}
</div>
