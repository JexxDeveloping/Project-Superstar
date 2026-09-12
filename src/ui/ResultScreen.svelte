<script lang="ts">
  import { store } from './store.svelte';
  import Chart from './Chart.svelte';
  import { boxOfficeOption } from './charts';
  import { formatMoney } from '../industry/BoxOfficeEngine';
  import { windowName } from '../world/ReleaseCalendarEngine';
  import { WOM_CLASS, WOM_LABEL, tagClass, verdictClass, weekNoteText } from './format';
  import type { MovieResult, StatDelta } from '../core/GameState';

  let { result }: { result: MovieResult } = $props();

  const movie = $derived(store.movie(result.movieId));
  const studio = $derived(movie ? store.studio(movie.studioId) : undefined);
  const run = $derived(result.boxOffice);
  const ratio = $derived(movie ? run.worldwide / movie.budget : 0);
  const vClass = $derived(verdictClass(run.verdict));
  const perfClass = $derived(result.performance.score >= 4 ? 'good' : result.performance.score >= 3 ? 'warn' : 'bad');
  const qClass = $derived(result.quality.q >= 65 ? 'good' : result.quality.q >= 50 ? 'warn' : 'bad');
  const titleOf = (id: string) => store.movie(id)?.title ?? 'another film';
  const window = $derived(movie?.releaseWeek !== undefined ? windowName(movie.releaseWeek) : undefined);

  function fmt(d: StatDelta): string {
    const n = d.amount;
    return `${n > 0 ? '+' : ''}${Number.isInteger(n) ? n : n.toFixed(1)}`;
  }
  /** Weeks worth a sentence: the opening, every growth/collapse/rival/holiday week, and the last week. */
  const story = $derived.by(() => {
    const out: { week: number; text: string; cls: string }[] = [];
    run.weeks.forEach((w, i) => {
      const k = w.note?.kind;
      if (!k) return;
      const interesting = i === 0 || i === run.weeks.length - 1 || (k !== 'dropped' && k !== 'held');
      if (!interesting) return;
      const cls = k === 'grew' || k === 'viral' || k === 'holiday' || k === 'opened_first' ? 'good' : k === 'crushed' || k === 'collapsed' ? 'bad' : '';
      const money = `${formatMoney(w.domestic)} dom`;
      out.push({ week: i + 1, text: `${weekNoteText(w.note, titleOf)} ${money}${w.rank ? ` · #${w.rank}` : ''}${i === run.weeks.length - 1 ? ' · left theaters' : ''}`, cls });
    });
    return out;
  });
</script>

<div class="modal-backdrop" role="presentation">
  <div class="modal result" role="dialog" aria-modal="true">
    <div class="head">
      <div>
        <h3>Movie result</h3>
        <h1 class="title">{result.title}</h1>
        <div class="muted">Budget {movie ? formatMoney(movie.budget) : ''} + {movie ? formatMoney(movie.marketingBudget) : ''} marketing · {movie?.genres.join(' / ')} · {studio?.name} · You: {result.characterName} ({result.roleType})</div>
      </div>
    </div>

    <div class="headline">“{result.headline}”</div>

    <div class="grid grid-3 axes">
      <div class="card axis">
        <div class="stat-label">Your performance</div>
        <div class="stat-big {perfClass}">{result.performance.score}/5 — {result.performance.label.toUpperCase()}</div>
        <div class="stars">{'★'.repeat(result.performance.score)}{'☆'.repeat(5 - result.performance.score)}</div>
        <ul class="notes">{#each result.performance.notes as n}<li>{n}</li>{/each}</ul>
      </div>
      <div class="card axis">
        <div class="stat-label">Movie quality</div>
        <div class="stat-big {qClass}">{result.quality.band.toUpperCase()}</div>
        <div class="muted">Critics <b class="mono">{result.quality.criticScore}%</b> · Audience <b class="mono">{result.quality.audienceScore}%</b></div>
        <ul class="notes">{#each result.quality.notes as n}<li>{n}</li>{/each}</ul>
        {#if movie?.reviews}
          <div class="quotes">
            {#each movie.reviews.critics as c}<div class="quote">“{c.text}” <span class="muted tiny">— {c.outlet}</span></div>{/each}
            <div class="quote muted">“{movie.reviews.audience}” <span class="tiny">— audience</span></div>
          </div>
        {/if}
      </div>
      <div class="card axis">
        <div class="stat-label">Commercial result</div>
        <div class="stat-big {vClass}">{run.verdict?.toUpperCase()}</div>
        {#if run.tags?.length}<div class="row wrap" style="margin:4px 0">{#each run.tags as t}<span class="tag {tagClass(t)}">{t}</span>{/each}</div>{/if}
        <div class="muted">Worldwide <b class="mono">{formatMoney(run.worldwide)}</b> · <b class="mono">{ratio.toFixed(2)}×</b> budget</div>
        {#if run.recoup !== undefined}
          <div class="muted small-text" style="margin-top:6px">Returned <b class="mono {vClass}">{run.recoup.toFixed(2)}×</b> its total cost · est. {run.profit! >= 0 ? 'profit' : 'loss'} <b class="mono">{formatMoney(Math.abs(run.profit!))}</b></div>
          <div class="muted tiny">Studio's take {formatMoney(run.theatricalTake!)} at the box office + {formatMoney(run.afterlife!)} afterlife (home, streaming, TV)</div>
        {/if}
        <div class="muted small-text" style="margin-top:6px">Opened #{run.openingRank}{window ? ` (${window})` : ''} · {formatMoney(run.openingDomestic)} dom / {formatMoney(run.openingInternational)} intl · {run.weeks.length}-week run · word of mouth <span class={WOM_CLASS[run.weeks[run.weeks.length - 1].wom ?? 'building']}>{WOM_LABEL[run.weeks[run.weeks.length - 1].wom ?? 'building'].toLowerCase()}</span></div>
        <div class="muted small-text">Final {formatMoney(run.totalDomestic)} dom / {formatMoney(run.totalInternational)} intl</div>
      </div>
    </div>

    <Chart option={boxOfficeOption(run)} height={190} />

    {#if story.length}
      <div class="card story">
        <div class="stat-label">How the run went</div>
        {#each story as s}<div class="row"><span class="muted tiny wk">Wk {s.week}</span><span class={s.cls}>{s.text}</span></div>{/each}
      </div>
    {/if}

    <div class="grid grid-3 impacts">
      <div class="card">
        <div class="stat-label">From your performance</div>
        {#each result.impacts.fromPerformance as d}<div class="row spread"><span>{d.label}</span><b class="mono" class:good={d.amount > 0} class:bad={d.amount < 0}>{fmt(d)}</b></div>{/each}
      </div>
      <div class="card">
        <div class="stat-label">From the film's quality</div>
        {#if result.impacts.fromQuality.length === 0}<div class="muted">—</div>{/if}
        {#each result.impacts.fromQuality as d}<div class="row spread"><span>{d.label}</span><b class="mono" class:good={d.amount > 0} class:bad={d.amount < 0}>{fmt(d)}</b></div>{/each}
      </div>
      <div class="card">
        <div class="stat-label">From the box office <span class="muted tiny">(fame follows gross, trust follows the verdict)</span></div>
        {#each result.impacts.fromCommercial as d}<div class="row spread"><span>{d.label}</span><b class="mono" class:good={d.amount > 0} class:bad={d.amount < 0}>{d.target === 'cash' ? formatMoney(d.amount) : fmt(d)}</b></div>{/each}
      </div>
    </div>

    <div class="row" style="justify-content:flex-end; margin-top:14px">
      <button class="primary" onclick={() => store.dismissResult()}>Continue career ▸</button>
    </div>
  </div>
</div>

<style>
  .result { width: min(1040px, 100%); }
  .title { font-size: 28px; }
  .headline { margin: 14px 0; padding: 12px 14px; border-left: 3px solid var(--accent); background: rgba(229, 184, 74, 0.07); font-weight: 700; letter-spacing: 0.02em; }
  .axes { margin-bottom: 12px; }
  .axis .stat-big { font-size: 20px; margin: 4px 0; }
  .stars { color: var(--accent); letter-spacing: 2px; font-size: 16px; }
  .notes { margin: 8px 0 0; padding-left: 16px; color: var(--muted); font-size: 12px; }
  .quotes { margin-top: 8px; display: grid; gap: 4px; }
  .quote { font-size: 12px; font-style: italic; }
  .story { margin-top: 12px; display: grid; gap: 4px; font-size: 13px; }
  .story .wk { width: 44px; display: inline-block; }
  .impacts { margin-top: 12px; }
  .impacts .card > .row { padding: 2px 0; font-size: 13px; }
</style>
