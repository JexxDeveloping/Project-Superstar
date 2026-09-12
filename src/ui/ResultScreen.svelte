<script lang="ts">
  import { store } from './store.svelte';
  import Chart from './Chart.svelte';
  import { boxOfficeOption } from './charts';
  import { formatMoney } from '../industry/BoxOfficeEngine';
  import type { MovieResult, StatDelta } from '../core/GameState';

  let { result }: { result: MovieResult } = $props();

  const movie = $derived(store.movie(result.movieId));
  const studio = $derived(movie ? store.studio(movie.studioId) : undefined);
  const ratio = $derived(movie ? result.boxOffice.worldwide / movie.budget : 0);
  const verdictClass = $derived(
    ['Hit', 'Super Hit', 'Blockbuster', 'All-Time Blockbuster'].includes(result.boxOffice.verdict!) ? 'good' : result.boxOffice.verdict === 'Average' ? 'warn' : 'bad',
  );
  const perfClass = $derived(result.performance.score >= 4 ? 'good' : result.performance.score >= 3 ? 'warn' : 'bad');
  const qClass = $derived(result.quality.q >= 65 ? 'good' : result.quality.q >= 50 ? 'warn' : 'bad');

  function fmt(d: StatDelta): string {
    const n = d.amount;
    return `${n > 0 ? '+' : ''}${Number.isInteger(n) ? n : n.toFixed(1)}`;
  }
</script>

<div class="modal-backdrop" role="presentation">
  <div class="modal result" role="dialog" aria-modal="true">
    <div class="head">
      <div>
        <h3>Movie result</h3>
        <h1 class="title">{result.title}</h1>
        <div class="muted">Budget {movie ? formatMoney(movie.budget) : ''} · {movie?.genres.join(' / ')} · {studio?.name} · You: {result.characterName} ({result.roleType})</div>
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
      </div>
      <div class="card axis">
        <div class="stat-label">Commercial result</div>
        <div class="stat-big {verdictClass}">{result.boxOffice.verdict?.toUpperCase()}</div>
        <div class="muted">Worldwide <b class="mono">{formatMoney(result.boxOffice.worldwide)}</b> · <b class="mono">{ratio.toFixed(2)}×</b> budget</div>
        <div class="muted small-text" style="margin-top:6px">Opening {formatMoney(result.boxOffice.openingDomestic)} dom / {formatMoney(result.boxOffice.openingInternational)} intl · {result.boxOffice.weeks.length}-week run</div>
        <div class="muted small-text">Final {formatMoney(result.boxOffice.totalDomestic)} dom / {formatMoney(result.boxOffice.totalInternational)} intl</div>
      </div>
    </div>

    <Chart option={boxOfficeOption(result.boxOffice)} height={190} />

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
        <div class="stat-label">From the box office</div>
        {#each result.impacts.fromCommercial as d}<div class="row spread"><span>{d.label}</span><b class="mono" class:good={d.amount > 0} class:bad={d.amount < 0}>{fmt(d)}</b></div>{/each}
      </div>
    </div>

    <div class="row" style="justify-content:flex-end; margin-top:14px">
      <button class="primary" onclick={() => store.dismissResult()}>Continue career ▸</button>
    </div>
  </div>
</div>

<style>
  .result { width: min(980px, 100%); }
  .title { font-size: 28px; }
  .headline { margin: 14px 0; padding: 12px 14px; border-left: 3px solid var(--accent); background: rgba(229, 184, 74, 0.07); font-weight: 700; letter-spacing: 0.02em; }
  .axes { margin-bottom: 12px; }
  .axis .stat-big { font-size: 20px; margin: 4px 0; }
  .stars { color: var(--accent); letter-spacing: 2px; font-size: 16px; }
  .notes { margin: 8px 0 0; padding-left: 16px; color: var(--muted); font-size: 12px; }
  .impacts { margin-top: 12px; }
  .impacts .card > .row { padding: 2px 0; font-size: 13px; }
</style>
