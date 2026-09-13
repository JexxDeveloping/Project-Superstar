<script lang="ts">
  import { store } from './store.svelte';
  import Chart from './Chart.svelte';
  import { dateForWeek, formatDate } from '../core/TimeEngine';
  import { formatMoney } from '../industry/BoxOfficeEngine';
  import { windowName } from '../world/ReleaseCalendarEngine';
  import { trendLabel } from '../world/TrendEngine';
  import { ageInYears, starTier } from '../sim/ActorEngine';
  import { GENRES, completedCredits, type Movie, type Person, type RecordSet } from '../core/GameState';
  import { WOM_CLASS, WOM_LABEL, tagClass, verdictClass } from './format';
  import { VERDICT_RANK } from '../industry/BoxOfficeEngine';
  import { TableSort } from './sort.svelte';
  import SortTh from './SortTh.svelte';
  import type { EChartsOption } from 'echarts';

  type Tab = 'boxoffice' | 'calendar' | 'movies' | 'people';
  type SubView = 'week' | 'records' | 'verdicts' | 'trends';
  let tab = $state<Tab>('boxoffice');
  /** Sections of the Box Office tab, one at a time (title = this week's chart). */
  let sub = $state<SubView>('week');
  let peopleFilter = $state<'active' | 'newcomers' | 'retired'>('active');
  const movieSort = new TableSort('year', 'desc');
  const peopleSort = new TableSort();

  const STATUS_LABEL: Record<Movie['status'], string> = { casting: 'Casting', 'pre-production': 'Pre-production', filming: 'Filming', 'post-production': 'Post', released: 'In theaters', completed: 'Done', cancelled: 'Cancelled' };
  const s = $derived(store.state!);
  const movies = $derived([...(store.world?.movies.values() ?? [])]);
  const people = $derived([...(store.world?.people.values() ?? [])].filter((p) => !p.isPlayer));
  const mine = $derived(new Set(s.player.filmography.map((f) => f.movieId)));

  const inTheaters = $derived(
    movies.filter((m) => m.status === 'released' && m.boxOffice).sort((a, b) => lastWeek(b).domestic - lastWeek(a).domestic),
  );
  function lastWeek(m: Movie) { return m.boxOffice!.weeks[m.boxOffice!.weeks.length - 1]; }
  function weekly(m: Movie): number { const w = lastWeek(m); return w.domestic + w.international; }
  function prevRank(m: Movie): number | undefined { const ws = m.boxOffice!.weeks; return ws.length > 1 ? ws[ws.length - 2].rank : undefined; }
  const recentlyClosed = $derived(
    movies.filter((m) => m.status === 'completed' && m.boxOffice).sort((a, b) => lastWeek(b).week - lastWeek(a).week).slice(0, 14),
  );

  /** The next 20 weeks of the calendar, week by week, with everything that has claimed a date. */
  const calendar = $derived.by(() => {
    const out: { week: number; window?: string; films: Movie[] }[] = [];
    const scheduled = movies.filter((m) => m.status === 'post-production' && m.releaseWeek !== undefined && m.releaseWeek > s.week);
    for (let w = s.week + 1; w <= s.week + 20; w++) {
      const films = scheduled.filter((m) => m.releaseWeek === w).sort((a, b) => b.budget + b.marketingBudget - (a.budget + a.marketingBudget));
      out.push({ week: w, window: windowName(w), films });
    }
    return out;
  });

  const chartOption = $derived.by((): EChartsOption => {
    const top = inTheaters.slice(0, 8);
    return {
      backgroundColor: 'transparent',
      textStyle: { color: '#e8ecf1' },
      tooltip: { trigger: 'axis', backgroundColor: '#1b212b', borderColor: '#2e3846', textStyle: { color: '#e8ecf1' }, valueFormatter: (v) => formatMoney(Number(v)) },
      grid: { left: 8, right: 8, top: 10, bottom: 4, containLabel: true },
      xAxis: { type: 'value', axisLabel: { color: '#8f9bab', formatter: (v: number) => formatMoney(v) }, splitLine: { lineStyle: { color: '#2e3846' } } },
      yAxis: { type: 'category', inverse: true, data: top.map((m) => m.title), axisLabel: { color: '#e8ecf1', width: 150, overflow: 'truncate' }, axisLine: { lineStyle: { color: '#2e3846' } } },
      series: [{ type: 'bar', data: top.map((m) => lastWeek(m).domestic), itemStyle: { color: '#e5b84a', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 18 }],
    };
  });

  const MOVIE_COLS = {
    year: (m: Movie) => m.releaseWeek ?? m.announcedWeek,
    title: (m: Movie) => m.title,
    studio: (m: Movie) => store.studio(m.studioId)?.name,
    genre: (m: Movie) => m.genres[0],
    lead: (m: Movie) => (m.cast.length ? store.personName(m.cast.slice().sort((a, b) => a.billing - b.billing)[0].personId) : undefined),
    director: (m: Movie) => { const d = store.director(m.directorId); return d ? `${d.lastName} ${d.firstName}` : undefined; },
    budget: (m: Movie) => m.budget,
    worldwide: (m: Movie) => m.boxOffice?.worldwide,
    recoup: (m: Movie) => m.boxOffice?.recoup,
    quality: (m: Movie) => (m.status === 'completed' || m.status === 'released' ? m.quality?.criticScore : undefined),
    status: (m: Movie) => STATUS_LABEL[m.status],
    verdict: (m: Movie) => (m.boxOffice?.verdict ? VERDICT_RANK[m.boxOffice.verdict] : undefined),
  };
  const sortedMovies = $derived(movieSort.apply(movies, MOVIE_COLS));

  const filteredPeople = $derived.by(() => {
    const yearStart = s.week - 52;
    let list: Person[];
    if (peopleFilter === 'retired') list = people.filter((p) => p.status === 'retired').sort((a, b) => b.peakStarPower - a.peakStarPower);
    else if (peopleFilter === 'newcomers') list = people.filter((p) => p.status === 'active' && p.startWeek >= yearStart).sort((a, b) => b.ceiling - a.ceiling);
    else list = people.filter((p) => p.status === 'active').sort((a, b) => b.attributes.starPower - a.attributes.starPower);
    return peopleSort.apply(list, PEOPLE_COLS).slice(0, 120);
  });
  const PEOPLE_COLS = {
    actor: (p: Person) => `${p.lastName} ${p.firstName}`,
    age: (p: Person) => ageInYears(p, s.week),
    tier: (p: Person) => (p.status === 'retired' ? p.peakStarPower : p.attributes.starPower),
    star: (p: Person) => p.attributes.starPower,
    acting: (p: Person) => p.attributes.acting,
    peak: (p: Person) => p.peakStarPower,
    films: (p: Person) => completedCredits(p).length,
    gross: (p: Person) => p.cumulativeGross ?? 0,
    review: (p: Person) => p.reviewAvg,
    now: (p: Person) => { const a = p.activeMovieIds[0] ? store.movie(p.activeMovieIds[0]) : undefined; return a ? `${STATUS_LABEL[a.status]} — ${a.title}` : p.status === 'retired' ? 'Retired' : 'Available'; },
  };

  const thisYear = $derived(dateForWeek(s.week, s.epochYear).year);
  const yearRecords = $derived<RecordSet>(s.records.byYear[thisYear] ?? {});
  const lastYearRecords = $derived<RecordSet>(s.records.byYear[thisYear - 1] ?? {});
  const trends = $derived(GENRES.map((g) => ({ g, t: s.genreTrends[g] ?? 1 })).sort((a, b) => b.t - a.t));

</script>

<div class="stack">
  <div class="row spread wrap">
    <div class="row subnav">
      <button class="title-tab" class:active={tab === 'boxoffice' && sub === 'week'} onclick={() => { tab = 'boxoffice'; sub = 'week'; }}><h2>Industry</h2></button>
      {#if tab === 'boxoffice'}
        <button class="sub" class:active={sub === 'records'} onclick={() => (sub = 'records')}>Records</button>
        <button class="sub" class:active={sub === 'verdicts'} onclick={() => (sub = 'verdicts')}>Recent Verdicts</button>
        <button class="sub" class:active={sub === 'trends'} onclick={() => (sub = 'trends')}>Genre Trends</button>
      {/if}
    </div>
    <div class="row">
      <button class="small" class:primary={tab === 'boxoffice'} onclick={() => { tab = 'boxoffice'; sub = 'week'; }}>Box Office</button>
      <button class="small" class:primary={tab === 'calendar'} onclick={() => (tab = 'calendar')}>Release Calendar</button>
      <button class="small" class:primary={tab === 'movies'} onclick={() => (tab = 'movies')}>Movies ({movies.length})</button>
      <button class="small" class:primary={tab === 'people'} onclick={() => (tab = 'people')}>People ({people.length})</button>
    </div>
  </div>

  {#if tab === 'boxoffice' && sub === 'week'}
    <section class="panel">
      <div class="panel-head">
        <div><h3>This week in theaters</h3><div class="muted tiny">Weekend box office — {formatDate(s.week, s.epochYear)}</div></div>
        <span class="muted tiny">{formatDate(s.week, s.epochYear)}{windowName(s.week) ? ` · ${windowName(s.week)}` : ''}</span>
      </div>
      {#if inTheaters.length === 0}
        <p class="muted">Nothing on screens this week.</p>
      {:else}
        <Chart option={chartOption} height={Math.max(120, 30 * Math.min(8, inTheaters.length) + 30)} />
        <div class="table-wrap">
        <table class="data" style="margin-top:8px">
          <thead><tr><th>#</th><th>Movie</th><th>Studio</th><th>Genre</th><th class="num">Week</th><th class="num">Domestic</th><th class="num">Change</th><th class="num">Worldwide</th><th>WOM</th></tr></thead>
          <tbody>
            {#each inTheaters as m (m.id)}
              {@const w = lastWeek(m)}
              {@const prev = prevRank(m)}
              {@const prevW = m.boxOffice!.weeks[m.boxOffice!.weeks.length - 2]}
              <tr class:mine={mine.has(m.id)}>
                <td class="muted mono">{w.rank}{#if prev !== undefined}<span class="tiny {prev > w.rank! ? 'good' : prev < w.rank! ? 'bad' : 'muted'}"> {prev > w.rank! ? '▲' : prev < w.rank! ? '▼' : '·'}</span>{:else}<span class="tiny accent"> new</span>{/if}</td>
                <td><strong>{m.title}</strong>{#if mine.has(m.id)}<span class="tag accent" style="margin-left:6px">You</span>{/if}<div class="muted tiny">{m.genres.join(' / ')} · {store.personName(m.cast.find((c) => c.billing === 1)?.personId ?? '')} · budget {formatMoney(m.budget)}</div></td>
                <td class="muted">{store.studio(m.studioId)?.name}</td>
                <td>{m.genres[0]}</td>
                <td class="num">{m.boxOffice!.weeks.length}</td>
                <td class="num mono">{formatMoney(w.domestic)}</td>
                <td class="num mono" class:good={prevW && w.domestic >= prevW.domestic} class:bad={prevW && w.domestic < prevW.domestic * 0.45}>{prevW ? `${w.domestic >= prevW.domestic ? '+' : ''}${Math.round(((w.domestic - prevW.domestic) / prevW.domestic) * 100)}%` : '—'}</td>
                <td class="num mono">{formatMoney(m.boxOffice!.worldwide)}</td>
                <td>{#if w.wom}<span class="tag {WOM_CLASS[w.wom]}">{WOM_LABEL[w.wom]}</span>{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        </div>
      {/if}
    </section>
  {:else if tab === 'boxoffice' && sub === 'records'}
    <section class="panel">
      <div class="panel-head"><h3>Records</h3><span class="muted tiny">{thisYear} · last year · all-time</span></div>
      <table class="data">
        <thead><tr><th></th><th>This year</th><th>Last year</th><th>All-time</th></tr></thead>
        <tbody>
          {#each [['Biggest opening', 'opening'], ['Biggest gross', 'gross'], ['Biggest bomb', 'bomb']] as [label, key]}
            {@const k = key as keyof RecordSet}
            <tr>
              <td class="muted">{label}</td>
              {#each [yearRecords[k], lastYearRecords[k], s.records.allTime[k]] as r}
                <td>{#if r}<strong>{r.title}</strong><div class="muted tiny mono">{formatMoney(r.amount)}{k === 'bomb' ? ' lost' : ''} · {dateForWeek(r.week, s.epochYear).year}</div>{:else}<span class="muted">—</span>{/if}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {:else if tab === 'boxoffice' && sub === 'verdicts'}
    <section class="panel">
      <div class="panel-head"><h3>Recent verdicts</h3><span class="muted tiny">the last {recentlyClosed.length} runs to finish</span></div>
      {#if recentlyClosed.length === 0}<p class="muted">No runs finished yet.</p>{:else}
        <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Movie</th><th>Studio</th><th class="num">Budget + marketing</th><th>Reception</th><th class="num">Worldwide</th><th class="num">Returned</th><th>Verdict</th></tr></thead>
          <tbody>
            {#each recentlyClosed as m (m.id)}
              <tr class:mine={mine.has(m.id)}>
                <td><strong>{m.title}</strong>{#if mine.has(m.id)}<span class="tag accent" style="margin-left:6px">You</span>{/if}<div class="muted tiny">{m.genres.join(' / ')} · {dateForWeek(m.releaseWeek ?? lastWeek(m).week, s.epochYear).year}</div></td>
                <td class="muted">{store.studio(m.studioId)?.name}</td>
                <td class="num mono muted">{formatMoney(m.budget)} + {formatMoney(m.marketingBudget)}</td>
                <td class="muted tiny">{m.quality?.criticScore}% critics · {m.quality?.audienceScore}% audience</td>
                <td class="num mono">{formatMoney(m.boxOffice!.worldwide)}</td>
                <td class="num mono" title="Studio's share of the box office plus the film's afterlife, over budget + marketing">{m.boxOffice!.recoup?.toFixed(2)}×</td>
                <td><span class="tag {verdictClass(m.boxOffice!.verdict)}">{m.boxOffice!.verdict}</span>{#each m.boxOffice!.tags ?? [] as t}<span class="tag {tagClass(t)}" style="margin-left:4px">{t}</span>{/each}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        </div>
      {/if}
    </section>
  {:else if tab === 'boxoffice' && sub === 'trends'}
    <section class="panel">
      <div class="panel-head"><h3>Genre trends</h3><span class="muted tiny">what audiences want right now · drifts over the years</span></div>
      <table class="data">
        <thead><tr><th>Genre</th><th>Trend</th><th class="num">Popularity</th></tr></thead>
        <tbody>
          {#each trends as { g, t }}
            <tr>
              <td><strong>{g}</strong></td>
              <td><span class="tag {t >= 1.08 ? 'good' : t <= 0.92 ? 'bad' : ''}">{trendLabel(t)}</span></td>
              <td class="num mono muted">{t >= 1 ? '+' : ''}{Math.round((t - 1) * 100)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="muted tiny" style="margin-top:8px">Hot genres open bigger and studios slate more of them; cold genres the reverse. Studios follow the fashion, which is how eras happen.</p>
    </section>
  {:else if tab === 'calendar'}
    <section class="panel">
      <div class="panel-head"><h3>Release calendar — next 20 weeks</h3><span class="muted tiny">Studios claim dates at wrap; a bigger film can push a smaller one off its week</span></div>
      <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Week</th><th>Window</th><th>Opening</th></tr></thead>
        <tbody>
          {#each calendar as row (row.week)}
            <tr class:holiday={!!row.window}>
              <td class="muted tiny" style="white-space:nowrap">{formatDate(row.week, s.epochYear)}</td>
              <td>{#if row.window}<span class="tag accent">{row.window}</span>{/if}</td>
              <td>
                {#if row.films.length === 0}<span class="muted tiny">—</span>{:else}
                  <div class="row wrap">
                    {#each row.films as m (m.id)}
                      <span class="film" class:mine={mine.has(m.id)} title={`${store.studio(m.studioId)?.name} · ${m.genres.join('/')} · budget ${formatMoney(m.budget)} + ${formatMoney(m.marketingBudget)} marketing`}>
                        <strong>{m.title}</strong> <span class="muted tiny">{m.budgetTier} · {m.genres[0]}{mine.has(m.id) ? ' · you' : ''}</span>
                      </span>
                    {/each}
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      </div>
    </section>
  {:else if tab === 'movies'}
    <section class="panel">
      <div class="panel-head"><h3>All movies</h3><span class="muted tiny">click a column to sort · again to flip</span></div>
      <div class="table-wrap">
      <table class="data">
        <thead><tr>
          <SortTh sort={movieSort} key="year" label="Year" /><SortTh sort={movieSort} key="title" label="Movie" /><SortTh sort={movieSort} key="studio" label="Studio" /><SortTh sort={movieSort} key="genre" label="Genre" /><SortTh sort={movieSort} key="lead" label="Lead" /><SortTh sort={movieSort} key="director" label="Director" />
          <SortTh sort={movieSort} key="budget" label="Budget" num /><SortTh sort={movieSort} key="worldwide" label="Worldwide" num /><SortTh sort={movieSort} key="recoup" label="Returned" num /><SortTh sort={movieSort} key="quality" label="Quality" /><SortTh sort={movieSort} key="status" label="Status" /><SortTh sort={movieSort} key="verdict" label="Verdict" />
        </tr></thead>
        <tbody>
          {#each sortedMovies.slice(0, 150) as m (m.id)}
            {@const d = store.director(m.directorId)}
            <tr class:mine={mine.has(m.id)}>
              <td class="muted">{dateForWeek(m.releaseWeek ?? m.announcedWeek, s.epochYear).year}</td>
              <td><strong>{m.title}</strong><div class="muted tiny">{m.rating} · {m.runtime} min{m.type === 'animation' ? ' · animated' : ''}</div></td>
              <td class="muted">{store.studio(m.studioId)?.name}</td>
              <td>{m.genres.join(' / ')}</td>
              <td>{m.cast.length ? store.personName(m.cast.slice().sort((a, b) => a.billing - b.billing)[0].personId) : '—'}</td>
              <td class="muted">{d ? `${d.firstName} ${d.lastName}` : ''}</td>
              <td class="num mono">{formatMoney(m.budget)}</td>
              <td class="num mono">{m.boxOffice ? formatMoney(m.boxOffice.worldwide) : '—'}</td>
              <td class="num mono muted">{m.boxOffice?.recoup !== undefined ? `${m.boxOffice.recoup.toFixed(2)}×` : '—'}</td>
              <td>{m.status === 'completed' || m.status === 'released' ? `${m.quality?.band} · ${m.quality?.criticScore}%` : '—'}</td>
              <td class="muted">{STATUS_LABEL[m.status]}</td>
              <td>{#if m.boxOffice?.verdict}<span class="tag {verdictClass(m.boxOffice.verdict)}">{m.boxOffice.verdict}</span>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      </div>
      {#if sortedMovies.length > 150}<p class="muted tiny" style="margin-top:8px">Showing 150 of {sortedMovies.length}. Filters arrive with the full universe tables (Phase 7).</p>{/if}
    </section>
  {:else}
    <section class="panel">
      <div class="panel-head"><h3>People</h3>
        <div class="row">
          <button class="small" class:primary={peopleFilter === 'active'} onclick={() => (peopleFilter = 'active')}>Active</button>
          <button class="small" class:primary={peopleFilter === 'newcomers'} onclick={() => (peopleFilter = 'newcomers')}>This year's class</button>
          <button class="small" class:primary={peopleFilter === 'retired'} onclick={() => (peopleFilter = 'retired')}>Retired</button>
        </div>
      </div>
      <div class="table-wrap">
      <table class="data">
        <thead><tr>
          <SortTh sort={peopleSort} key="actor" label="Actor" /><SortTh sort={peopleSort} key="age" label="Age" num /><SortTh sort={peopleSort} key="tier" label="Tier" /><SortTh sort={peopleSort} key="star" label="Star" num /><SortTh sort={peopleSort} key="acting" label="Acting" num /><SortTh sort={peopleSort} key="peak" label="Peak" num />
          <SortTh sort={peopleSort} key="films" label="Films" num /><SortTh sort={peopleSort} key="gross" label="Cumulative gross" num /><SortTh sort={peopleSort} key="review" label="Avg review" num /><SortTh sort={peopleSort} key="now" label="Now" />
        </tr></thead>
        <tbody>
          {#each filteredPeople as p (p.id)}
            {@const active = p.activeMovieIds[0] ? store.movie(p.activeMovieIds[0]) : undefined}
            <tr>
              <td><strong>{p.firstName} {p.lastName}</strong><div class="muted tiny">{p.archetype}{p.status === 'retired' && p.retiredWeek !== undefined ? ` · retired ${dateForWeek(p.retiredWeek, s.epochYear).year}` : ''}</div></td>
              <td class="num">{ageInYears(p, s.week)}</td>
              <td class="muted">{starTier(p.status === 'retired' ? p.peakStarPower : p.attributes.starPower)}</td>
              <td class="num mono">{Math.round(p.attributes.starPower)}</td>
              <td class="num mono">{Math.round(p.attributes.acting)}</td>
              <td class="num mono">{Math.round(p.peakStarPower)}</td>
              <td class="num">{completedCredits(p).length}</td>
              <td class="num mono">{formatMoney(p.cumulativeGross ?? 0)}</td>
              <td class="num mono muted">{p.reviewAvg !== undefined ? `${Math.round(p.reviewAvg)}%` : '—'}</td>
              <td class="muted tiny">{active ? `${STATUS_LABEL[active.status]} — ${active.title}` : p.status === 'retired' ? 'Retired' : 'Available'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      </div>
    </section>
  {/if}
</div>

<style>
  .subnav { gap: 18px; align-items: baseline; }
  .title-tab { background: transparent; border: none; padding: 0 0 4px; border-bottom: 2px solid transparent; border-radius: 0; color: inherit; cursor: pointer; }
  .title-tab.active { border-bottom-color: var(--accent); }
  .title-tab h2 { margin: 0; }
  .sub { background: transparent; border: none; padding: 0 0 4px; border-bottom: 2px solid transparent; border-radius: 0; color: var(--muted); font-size: 15px; cursor: pointer; }
  /* Hover: no fill on the word; the gold underline appears and glows upward into the text. */
  .sub:hover, .title-tab:hover { color: var(--text); background: transparent; border-bottom-color: var(--accent); box-shadow: 0 6px 14px -6px rgba(229, 184, 74, 0.55); }
  .sub.active { color: var(--text); border-bottom-color: var(--accent); }
  tr.mine td { background: rgba(229, 184, 74, 0.06); }
  tr.holiday td { background: rgba(90, 169, 230, 0.05); }
  .film { display: inline-block; padding: 3px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-2); font-size: 12px; }
  .film.mine { border-color: var(--accent); }
</style>
