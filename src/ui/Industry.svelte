<script lang="ts">
  import { store } from './store.svelte';
  import Chart from './Chart.svelte';
  import { dateForWeek, formatDate } from '../core/TimeEngine';
  import { formatMoney } from '../industry/BoxOfficeEngine';
  import { ageInYears, starTier } from '../sim/ActorEngine';
  import type { Movie, Person } from '../core/GameState';
  import type { EChartsOption } from 'echarts';

  type Tab = 'boxoffice' | 'movies' | 'people';
  let tab = $state<Tab>('boxoffice');
  let peopleFilter = $state<'active' | 'newcomers' | 'retired'>('active');
  let movieSort = $state<'recent' | 'gross' | 'quality'>('recent');

  const s = $derived(store.state!);
  const movies = $derived([...(store.world?.movies.values() ?? [])]);
  const people = $derived([...(store.world?.people.values() ?? [])].filter((p) => !p.isPlayer));

  const inTheaters = $derived(
    movies.filter((m) => m.status === 'released' && m.boxOffice).sort((a, b) => weekly(b) - weekly(a)),
  );
  function weekly(m: Movie): number {
    const w = m.boxOffice!.weeks[m.boxOffice!.weeks.length - 1];
    return w.domestic + w.international;
  }
  const upcoming = $derived(movies.filter((m) => m.status === 'post-production' && m.releaseWeek !== undefined).sort((a, b) => a.releaseWeek! - b.releaseWeek!).slice(0, 8));
  const recentlyClosed = $derived(
    movies.filter((m) => m.status === 'completed' && m.boxOffice).sort((a, b) => lastWeek(b) - lastWeek(a)).slice(0, 8),
  );
  function lastWeek(m: Movie): number { return m.boxOffice!.weeks[m.boxOffice!.weeks.length - 1].week; }

  const chartOption = $derived.by((): EChartsOption => {
    const top = inTheaters.slice(0, 8);
    return {
      backgroundColor: 'transparent',
      textStyle: { color: '#e8ecf1' },
      tooltip: { trigger: 'axis', backgroundColor: '#1b212b', borderColor: '#2e3846', textStyle: { color: '#e8ecf1' }, valueFormatter: (v) => formatMoney(Number(v)) },
      grid: { left: 8, right: 8, top: 10, bottom: 4, containLabel: true },
      xAxis: { type: 'value', axisLabel: { color: '#8f9bab', formatter: (v: number) => formatMoney(v) }, splitLine: { lineStyle: { color: '#2e3846' } } },
      yAxis: { type: 'category', inverse: true, data: top.map((m) => m.title), axisLabel: { color: '#e8ecf1', width: 150, overflow: 'truncate' }, axisLine: { lineStyle: { color: '#2e3846' } } },
      series: [{ type: 'bar', data: top.map((m) => weekly(m)), itemStyle: { color: '#e5b84a', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 18 }],
    };
  });

  const sortedMovies = $derived.by(() => {
    const list = movies.filter((m) => m.status !== 'casting' || true);
    if (movieSort === 'gross') return list.slice().sort((a, b) => (b.boxOffice?.worldwide ?? -1) - (a.boxOffice?.worldwide ?? -1));
    if (movieSort === 'quality') return list.slice().sort((a, b) => (b.quality?.q ?? -1) - (a.quality?.q ?? -1));
    return list.slice().sort((a, b) => b.announcedWeek - a.announcedWeek);
  });

  const filteredPeople = $derived.by(() => {
    const yearStart = s.week - 52;
    let list: Person[];
    if (peopleFilter === 'retired') list = people.filter((p) => p.status === 'retired').sort((a, b) => b.peakStarPower - a.peakStarPower);
    else if (peopleFilter === 'newcomers') list = people.filter((p) => p.status === 'active' && p.startWeek >= yearStart).sort((a, b) => b.ceiling - a.ceiling);
    else list = people.filter((p) => p.status === 'active').sort((a, b) => b.attributes.starPower - a.attributes.starPower);
    return list.slice(0, 120);
  });

  function totalGross(p: Person): number {
    return p.filmography.reduce((sum, f) => sum + (store.movie(f.movieId)?.boxOffice?.worldwide ?? 0), 0);
  }
  function verdictClass(v?: string): string {
    if (!v) return '';
    return ['Hit', 'Super Hit', 'Blockbuster', 'All-Time Blockbuster'].includes(v) ? 'good' : v === 'Average' ? '' : 'bad';
  }
  const STATUS_LABEL: Record<Movie['status'], string> = { casting: 'Casting', 'pre-production': 'Pre-production', filming: 'Filming', 'post-production': 'Post', released: 'In theaters', completed: 'Done', cancelled: 'Cancelled' };
</script>

<div class="stack">
  <div class="row spread">
    <h2>Industry</h2>
    <div class="row">
      <button class="small" class:primary={tab === 'boxoffice'} onclick={() => (tab = 'boxoffice')}>Box Office</button>
      <button class="small" class:primary={tab === 'movies'} onclick={() => (tab = 'movies')}>Movies ({movies.length})</button>
      <button class="small" class:primary={tab === 'people'} onclick={() => (tab = 'people')}>People ({people.length})</button>
    </div>
  </div>

  {#if tab === 'boxoffice'}
    <div class="grid grid-2">
      <section class="panel">
        <div class="panel-head"><h3>This week in theaters</h3><span class="muted tiny">{formatDate(s.week, s.epochYear)}</span></div>
        {#if inTheaters.length === 0}
          <p class="muted">Nothing on screens this week.</p>
        {:else}
          <Chart option={chartOption} height={Math.max(120, 30 * Math.min(8, inTheaters.length) + 30)} />
          <div class="table-wrap">
          <table class="data" style="margin-top:8px">
            <thead><tr><th>#</th><th>Movie</th><th>Studio</th><th class="num">Week</th><th class="num">This week</th><th class="num">Total</th><th class="num">Budget</th></tr></thead>
            <tbody>
              {#each inTheaters as m, i (m.id)}
                <tr>
                  <td class="muted">{i + 1}</td>
                  <td><strong>{m.title}</strong><div class="muted tiny">{m.genres.join(' / ')} · {store.personName(m.cast.find((c) => c.billing === 1)?.personId ?? '')}</div></td>
                  <td class="muted">{store.studio(m.studioId)?.name}</td>
                  <td class="num">{m.boxOffice!.weeks.length}</td>
                  <td class="num mono">{formatMoney(weekly(m))}</td>
                  <td class="num mono">{formatMoney(m.boxOffice!.worldwide)}</td>
                  <td class="num mono muted">{formatMoney(m.budget)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          </div>
        {/if}
      </section>
      <div class="stack">
        <section class="panel">
          <div class="panel-head"><h3>Upcoming releases</h3></div>
          {#if upcoming.length === 0}<p class="muted">Nothing scheduled.</p>{:else}
            <table class="data">
              <thead><tr><th>Opens</th><th>Movie</th><th class="num">Budget</th></tr></thead>
              <tbody>
                {#each upcoming as m (m.id)}
                  <tr><td class="muted tiny">{formatDate(m.releaseWeek!, s.epochYear)}</td><td><strong>{m.title}</strong><div class="muted tiny">{m.genres.join(' / ')} · {store.studio(m.studioId)?.name}</div></td><td class="num mono">{formatMoney(m.budget)}</td></tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </section>
        <section class="panel">
          <div class="panel-head"><h3>Recent verdicts</h3></div>
          {#if recentlyClosed.length === 0}<p class="muted">No runs finished yet.</p>{:else}
            <table class="data">
              <thead><tr><th>Movie</th><th class="num">Worldwide</th><th class="num">×</th><th>Verdict</th></tr></thead>
              <tbody>
                {#each recentlyClosed as m (m.id)}
                  <tr><td><strong>{m.title}</strong><div class="muted tiny">{m.quality?.criticScore}% critics · {m.quality?.audienceScore}% audience</div></td><td class="num mono">{formatMoney(m.boxOffice!.worldwide)}</td><td class="num mono">{(m.boxOffice!.worldwide / m.budget).toFixed(2)}</td><td><span class="tag {verdictClass(m.boxOffice!.verdict)}">{m.boxOffice!.verdict}</span></td></tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </section>
      </div>
    </div>
  {:else if tab === 'movies'}
    <section class="panel">
      <div class="panel-head"><h3>All movies</h3>
        <div class="row"><span class="muted tiny">Sort</span>
          <button class="small" class:primary={movieSort === 'recent'} onclick={() => (movieSort = 'recent')}>Recent</button>
          <button class="small" class:primary={movieSort === 'gross'} onclick={() => (movieSort = 'gross')}>Gross</button>
          <button class="small" class:primary={movieSort === 'quality'} onclick={() => (movieSort = 'quality')}>Quality</button>
        </div>
      </div>
      <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Year</th><th>Movie</th><th>Studio</th><th>Genre</th><th>Lead</th><th>Director</th><th class="num">Budget</th><th class="num">Worldwide</th><th>Quality</th><th>Status</th><th>Verdict</th></tr></thead>
        <tbody>
          {#each sortedMovies.slice(0, 150) as m (m.id)}
            {@const d = store.director(m.directorId)}
            <tr>
              <td class="muted">{dateForWeek(m.releaseWeek ?? m.announcedWeek, s.epochYear).year}</td>
              <td><strong>{m.title}</strong></td>
              <td class="muted">{store.studio(m.studioId)?.name}</td>
              <td>{m.genres.join(' / ')}</td>
              <td>{m.cast.length ? store.personName(m.cast.slice().sort((a, b) => a.billing - b.billing)[0].personId) : '—'}</td>
              <td class="muted">{d ? `${d.firstName} ${d.lastName}` : ''}</td>
              <td class="num mono">{formatMoney(m.budget)}</td>
              <td class="num mono">{m.boxOffice ? formatMoney(m.boxOffice.worldwide) : '—'}</td>
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
        <thead><tr><th>Actor</th><th class="num">Age</th><th>Tier</th><th class="num">Star</th><th class="num">Acting</th><th class="num">Peak</th><th class="num">Films</th><th class="num">Cumulative gross</th><th>Now</th></tr></thead>
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
              <td class="num">{p.filmography.length}</td>
              <td class="num mono">{formatMoney(totalGross(p))}</td>
              <td class="muted tiny">{active ? `${STATUS_LABEL[active.status]} — ${active.title}` : p.status === 'retired' ? 'Retired' : 'Available'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      </div>
    </section>
  {/if}
</div>
