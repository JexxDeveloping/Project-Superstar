<script lang="ts">
  import { store } from './store.svelte';
  import Chart from './Chart.svelte';
  import { boxOfficeOption } from './charts';
  import { formatDate } from '../core/TimeEngine';
  import { formatMoney, weekOverWeek } from '../industry/BoxOfficeEngine';
  import { campaignBand, windowName } from '../world/ReleaseCalendarEngine';
  import { PREP_ROLE_CAP } from '../sim/ActorEngine';
  import { CAMPAIGN_LABEL, WOM_CLASS, WOM_LABEL, weekNoteText } from './format';
  import type { Movie } from '../core/GameState';

  const s = $derived(store.state!);
  const prod = $derived(s.activeProduction);
  const prodMovie = $derived(prod ? store.movie(prod.movieId) : undefined);
  const tracked = $derived(
    s.trackedMovieIds.map((id) => store.movie(id)).filter((m): m is Movie => !!m && m.status !== 'filming' && m.status !== 'pre-production'),
  );
  const titleOf = (id: string) => store.movie(id)?.title ?? 'another film';

  function openingLine(m: Movie): { verdict: string; cls: string } {
    const r = m.boxOffice!;
    const t = m.tracking;
    if (!t) return { verdict: `It opened to ${formatMoney(r.openingDomestic)} domestic.`, cls: '' };
    if (r.openingDomestic > t.high) return { verdict: `Tracking said ${formatMoney(t.low)}–${formatMoney(t.high)}. It did ${formatMoney(r.openingDomestic)}.`, cls: 'good' };
    if (r.openingDomestic < t.low) return { verdict: `Tracking said ${formatMoney(t.low)}–${formatMoney(t.high)}. It did ${formatMoney(r.openingDomestic)}.`, cls: 'bad' };
    return { verdict: `Tracking said ${formatMoney(t.low)}–${formatMoney(t.high)}. It did ${formatMoney(r.openingDomestic)} — on the money.`, cls: 'warn' };
  }
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
    {@const window = m.releaseWeek !== undefined ? windowName(m.releaseWeek) : undefined}
    <section class="panel">
      <div class="panel-head">
        <div><h2>{m.title}</h2><div class="muted tiny">{m.genres.join(' / ')} · {store.studio(m.studioId)?.name} · Budget {formatMoney(m.budget)} · Marketing {CAMPAIGN_LABEL[campaignBand(m)].toLowerCase()} ({formatMoney(m.marketingBudget)})</div></div>
        <span class="tag {m.status === 'released' ? 'accent' : 'info'}">{m.status === 'released' ? 'In theaters' : 'Post-production'}</span>
      </div>
      {#if m.status === 'post-production'}
        <p class="muted">Editing, scoring, marketing. Opens {formatDate(m.releaseWeek!, s.epochYear)}{window ? ` — ${window}` : ''}{(m.dateMoves ?? 0) > 0 ? ' (date moved by the studio)' : ''}. Your performance and the film's quality are locked — the world sees them on release.</p>
        {#if m.tracking}
          <div class="card" style="margin-top:10px">
            <div class="stat-label">Tracking</div>
            <div class="stat-big mono">{formatMoney(m.tracking.low)}–{formatMoney(m.tracking.high)}</div>
            <div class="muted tiny">The studio's estimate of the domestic opening. The number to beat.</div>
          </div>
        {:else}
          <p class="muted tiny" style="margin-top:8px">Tracking arrives the week before release.</p>
        {/if}
      {:else if m.boxOffice}
        {@const r = m.boxOffice}
        {@const last = r.weeks[r.weeks.length - 1]}
        {@const reveal = openingLine(m)}
        <div class="reveal {reveal.cls}">
          <div class="reveal-main">Opened <b>#{r.openingRank}</b>{window ? ` on ${window}` : ''}. {reveal.verdict}</div>
          {#if r.openingRank && r.openingRank > 1 && r.weeks[0].note?.rivalId}<div class="muted tiny">Behind {titleOf(r.weeks[0].note.rivalId)}.</div>{/if}
        </div>
        <div class="grid grid-3" style="margin:12px 0">
          <div class="card"><div class="stat-label">Worldwide to date</div><div class="stat-big mono">{formatMoney(r.worldwide)}</div><div class="muted tiny">{formatMoney(r.totalDomestic)} dom · {formatMoney(r.totalInternational)} intl</div></div>
          <div class="card"><div class="stat-label">This week</div><div class="stat-big mono">#{last.rank}</div><div class="muted tiny">Week {r.weeks.length} · {formatMoney(last.domestic + last.international)} worldwide</div></div>
          <div class="card"><div class="stat-label">Word of mouth</div><div class="stat-big {WOM_CLASS[last.wom ?? 'building']}">{WOM_LABEL[last.wom ?? 'building']}</div><div class="muted tiny">Critics {m.quality?.criticScore}% · Audience {m.quality?.audienceScore}%</div></div>
        </div>
        <Chart option={boxOfficeOption(r)} height={200} />
        <table class="data" style="margin-top:10px">
          <thead><tr><th>Week</th><th class="num">#</th><th class="num">Domestic</th><th class="num">Change</th><th class="num">International</th><th class="num">Week total</th><th>WOM</th><th>What happened</th></tr></thead>
          <tbody>
            {#each r.weeks as w, i}
              {@const wow = weekOverWeek(r, i)}
              <tr>
                <td class="muted">Week {i + 1}</td>
                <td class="num mono">{w.rank ?? '—'}</td>
                <td class="num mono">{formatMoney(w.domestic)}</td>
                <td class="num mono" class:good={wow !== null && wow >= 0} class:bad={wow !== null && wow < -0.55}>{wow === null ? '—' : `${wow >= 0 ? '+' : ''}${Math.round(wow * 100)}%`}</td>
                <td class="num mono">{formatMoney(w.international)}</td>
                <td class="num mono">{formatMoney(w.domestic + w.international)}</td>
                <td>{#if w.wom}<span class="tag {WOM_CLASS[w.wom]}">{WOM_LABEL[w.wom]}</span>{/if}</td>
                <td class="muted small-text">{weekNoteText(w.note, titleOf)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if m.reviews}
          <div class="reviews">
            {#each m.reviews.critics as c}<div class="quote">“{c.text}” <span class="muted tiny">— {c.outlet}</span></div>{/each}
            <div class="quote muted">“{m.reviews.audience}” <span class="tiny">— audience</span></div>
          </div>
        {/if}
      {/if}
    </section>
  {/each}
</div>

<style>
  .reveal { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-2); }
  .reveal.good { border-color: rgba(95, 201, 141, 0.5); }
  .reveal.bad { border-color: rgba(224, 101, 101, 0.5); }
  .reveal.warn { border-color: rgba(233, 160, 75, 0.5); }
  .reveal-main { font-size: 16px; font-weight: 600; }
  .reviews { margin-top: 12px; display: grid; gap: 6px; }
  .quote { font-size: 13px; font-style: italic; }
</style>
