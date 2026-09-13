<script lang="ts">
  import { store } from './store.svelte';
  import { dateForWeek } from '../core/TimeEngine';
  import { formatMoney } from '../industry/BoxOfficeEngine';
  import { tagClass, verdictClass } from './format';
  import { VERDICT_RANK } from '../industry/BoxOfficeEngine';
  import { TableSort } from './sort.svelte';
  import SortTh from './SortTh.svelte';
  import type { FilmCredit } from '../core/GameState';

  const s = $derived(store.state!);
  const sort = new TableSort();
  const COLS = {
    year: (c: FilmCredit) => store.movie(c.movieId)?.releaseWeek,
    age: (c: FilmCredit) => c.ageAtRelease,
    movie: (c: FilmCredit) => store.movie(c.movieId)?.title,
    role: (c: FilmCredit) => c.characterName,
    genre: (c: FilmCredit) => store.movie(c.movieId)?.genres[0],
    budget: (c: FilmCredit) => store.movie(c.movieId)?.budget,
    boxOffice: (c: FilmCredit) => { const m = store.movie(c.movieId); return m?.boxOffice?.finished ? m.boxOffice.worldwide : undefined; },
    backend: (c: FilmCredit) => c.backend,
    performance: (c: FilmCredit) => c.performance?.score,
    rating: (c: FilmCredit) => { const m = store.movie(c.movieId); return m?.boxOffice?.finished ? m.quality?.criticScore : undefined; },
    result: (c: FilmCredit) => { const m = store.movie(c.movieId); return m?.boxOffice?.verdict ? VERDICT_RANK[m.boxOffice.verdict] : c.status === 'cancelled' ? -1 : undefined; },
  };
  const credits = $derived(sort.apply(s.player.filmography.slice().reverse(), COLS));
</script>

<section class="panel">
  <div class="panel-head"><h2>Filmography</h2><span class="muted tiny">{credits.length} credit{credits.length === 1 ? '' : 's'} · career earnings {formatMoney(s.player.careerEarnings)}</span></div>
  {#if credits.length === 0}
    <p class="muted">No credits yet. Book a role and finish the shoot.</p>
  {:else}
    <div class="table-wrap">
    <table class="data">
      <thead><tr>
        <SortTh {sort} key="year" label="Year" /><SortTh {sort} key="age" label="Age" /><SortTh {sort} key="movie" label="Movie" /><SortTh {sort} key="role" label="Role" /><SortTh {sort} key="genre" label="Genre" /><SortTh {sort} key="budget" label="Budget" num /><SortTh {sort} key="boxOffice" label="Box Office" num /><SortTh {sort} key="backend" label="Backend" num /><SortTh {sort} key="performance" label="Performance" /><SortTh {sort} key="rating" label="Movie Rating" /><SortTh {sort} key="result" label="Result" />
      </tr></thead>
      <tbody>
        {#each credits as c}
          {@const m = store.movie(c.movieId)}
          {@const done = m?.boxOffice?.finished}
          <tr>
            <td class="muted">{m?.releaseWeek !== undefined ? dateForWeek(m.releaseWeek, s.epochYear).year : '—'}</td>
            <td class="muted">{c.ageAtRelease ?? '—'}</td>
            <td><strong>{m?.title}</strong></td>
            <td>{c.characterName}<div class="muted tiny">{c.roleType}</div></td>
            <td>{m?.genres.join(' / ')}</td>
            <td class="num mono">{m ? formatMoney(m.budget) : ''}</td>
            <td class="num mono">{done ? formatMoney(m!.boxOffice!.worldwide) : '—'}</td>
            <td class="num mono muted">{done && c.backend !== undefined ? formatMoney(c.backend) : '—'}</td>
            <td>{c.status === 'cancelled' ? 'Never shot' : done && c.performance ? `${c.performance.score}/5 — ${c.performance.label}` : done ? '—' : 'Unreleased'}</td>
            <td>{done && m?.quality ? `${m.quality.band} · ${m.quality.criticScore}%` : '—'}</td>
            <td>{#if c.status === 'cancelled'}<span class="tag bad" title={m?.cancelledReason ?? ''}>Cancelled</span>{:else if done}<span class="tag {verdictClass(m!.boxOffice!.verdict)}" title={m!.boxOffice!.recoup !== undefined ? `Returned ${m!.boxOffice!.recoup.toFixed(2)}× its cost` : ''}>{m!.boxOffice!.verdict}</span>{#each m!.boxOffice!.tags ?? [] as t}<span class="tag {tagClass(t)}" style="margin-left:4px">{t}</span>{/each}{:else}<span class="muted">—</span>{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
  {/if}
</section>
