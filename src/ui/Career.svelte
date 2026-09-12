<script lang="ts">
  import { store } from './store.svelte';
  import { dateForWeek } from '../core/TimeEngine';
  import { formatMoney } from '../industry/BoxOfficeEngine';
  import { tagClass, verdictClass } from './format';

  const s = $derived(store.state!);
  const credits = $derived(s.player.filmography.slice().reverse());
</script>

<section class="panel">
  <div class="panel-head"><h2>Filmography</h2><span class="muted tiny">{credits.length} credit{credits.length === 1 ? '' : 's'} · career earnings {formatMoney(s.player.careerEarnings)}</span></div>
  {#if credits.length === 0}
    <p class="muted">No credits yet. Book a role and finish the shoot.</p>
  {:else}
    <table class="data">
      <thead><tr><th>Year</th><th>Age</th><th>Movie</th><th>Role</th><th>Genre</th><th class="num">Budget</th><th class="num">Box Office</th><th class="num">Backend</th><th>Performance</th><th>Movie Rating</th><th>Result</th></tr></thead>
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
  {/if}
</section>
