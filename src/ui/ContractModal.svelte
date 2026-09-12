<script lang="ts">
  import { store } from './store.svelte';
  import { COUNTER_LABEL, counterAvailable } from '../industry/ContractEngine';
  import { formatMoney } from '../industry/BoxOfficeEngine';
  import { formatDate } from '../core/TimeEngine';
  import type { CounterMove } from '../core/GameState';

  let { listingId }: { listingId: string } = $props();

  const s = $derived(store.state!);
  const app = $derived(s.applications.find((a) => a.listingId === listingId));
  const offer = $derived(app?.contract);
  const movie = $derived(app ? store.movie(app.movieId) : undefined);
  const studio = $derived(movie ? store.studio(movie.studioId) : undefined);
  const agent = $derived(store.agent());
  const MOVES: CounterMove[] = ['higher_salary', 'backend', 'top_billing', 'drop_sequel', 'pay_or_play'];
  const HINT: Record<CounterMove, string> = {
    higher_salary: 'The cheapest ask. Usually gets something.',
    backend: 'Gross points are real money on a hit — and the priciest ask. If they only offer "net", it pays nothing.',
    top_billing: 'Cheap unless a bigger name already holds it.',
    drop_sequel: 'A studio-favourable option locks your sequel rate low. Rookie mistake to leave it in cheaply.',
    pay_or_play: 'You get paid even if the film collapses before cameras roll.',
  };

  function close() { store.openContractListingId = null; store.lastNegotiation = null; }
  function sign() { store.acceptOffer(listingId); close(); }
  const commission = $derived(agent ? agent.commission : 0);
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') close(); }} />

<div class="modal-backdrop" onclick={close} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    {#if !app || !offer || !movie}
      <p class="muted">This offer is no longer on the table.</p>
      <button onclick={close}>Close</button>
    {:else}
      <div class="row spread">
        <div>
          <h3>Contract — {studio?.name}</h3>
          <h1>{app.characterName} <span class="muted" style="font-weight:500">· {app.roleType} in {movie.title}</span></h1>
          <div class="muted small-text">{movie.genres.join(' / ')} · budget {formatMoney(movie.budget)} · shoot {formatDate(movie.productionStartWeek, s.epochYear)} for {movie.productionWeeks} weeks · {app.source === 'direct' ? 'direct offer' : 'won in the room'}</div>
        </div>
        <button class="ghost" onclick={close}>✕</button>
      </div>

      <div class="grid grid-2" style="margin:14px 0; align-items:start">
        <section class="panel">
          <div class="panel-head"><h3>Terms</h3><span class="tag {offer.status === 'open' ? 'good' : 'bad'}">{offer.status === 'open' ? `Round ${offer.round} of ${offer.maxRounds}` : offer.status}</span></div>
          <table class="data">
            <tbody>
              <tr><td class="muted">Base salary</td><td class="num mono"><strong>{formatMoney(offer.terms.baseSalary)}</strong>{#if offer.terms.baseSalary !== offer.original.baseSalary}<span class="good tiny"> (from {formatMoney(offer.original.baseSalary)})</span>{/if}</td></tr>
              <tr><td class="muted">Box-office bonus</td><td class="num mono">{offer.terms.bonuses.length ? offer.terms.bonuses.map((b) => `${formatMoney(b.amount)} at ${b.multiple}×`).join(' · ') : '—'}</td></tr>
              <tr><td class="muted">Gross points</td><td class="num mono">{offer.terms.grossPoints ? `${offer.terms.grossPoints}% of worldwide` : '—'}</td></tr>
              <tr><td class="muted">Net points</td><td class="num mono">{offer.terms.netPoints ? `${offer.terms.netPoints}% of "net profit"` : '—'}</td></tr>
              <tr><td class="muted">Billing</td><td class="num mono">#{offer.terms.billing}</td></tr>
              <tr><td class="muted">Sequel option</td><td class="num mono">{offer.terms.sequelOption ? `Yes — locked at ${formatMoney(offer.terms.sequelOptionRate ?? 0)}` : 'None'}</td></tr>
              <tr><td class="muted">Promotion</td><td class="num mono">{offer.terms.promoWeeks} week{offer.terms.promoWeeks === 1 ? '' : 's'}</td></tr>
              <tr><td class="muted">Pay-or-play</td><td class="num mono">{offer.terms.payOrPlay ? 'Yes' : 'No'}</td></tr>
              {#if commission}<tr><td class="muted">Agent commission</td><td class="num mono">{Math.round(commission * 100)}% → you net {formatMoney(offer.terms.baseSalary * (1 - commission))} base</td></tr>{/if}
            </tbody>
          </table>
        </section>

        <div class="stack">
          <section class="panel read">
            <div class="panel-head"><h3>The read</h3></div>
            <p class="read-text">{offer.agentRead}</p>
            {#if !agent}<p class="muted tiny">An agent would tell you how much room there really is.</p>{/if}
          </section>

          {#if store.lastNegotiation}
            <section class="panel reply {store.lastNegotiation.response}">
              <div class="panel-head"><h3>Studio reply</h3><span class="tag {store.lastNegotiation.response === 'accepted' ? 'good' : store.lastNegotiation.response === 'withdrew' ? 'bad' : 'warn'}">{store.lastNegotiation.response}</span></div>
              <p>{store.lastNegotiation.text}</p>
            </section>
          {/if}

          {#if offer.log.length > 0}
            <section class="panel">
              <div class="panel-head"><h3>Rounds so far</h3></div>
              <ul class="log">{#each offer.log as e}<li><span class="muted">#{e.round}</span> {COUNTER_LABEL[e.move]} → <b>{e.response}</b></li>{/each}</ul>
            </section>
          {/if}
        </div>
      </div>

      {#if offer.status === 'open'}
        <section class="panel">
          <div class="panel-head"><h3>Push on a term</h3><span class="muted tiny">Each ask costs goodwill. Greed can lose the role.</span></div>
          <div class="moves">
            {#each MOVES as move}
              {@const ok = counterAvailable(offer, move)}
              <button class="move" disabled={!ok} onclick={() => store.counterOffer(listingId, move)}>
                <strong>{COUNTER_LABEL[move]}</strong>
                <span class="muted tiny">{ok ? HINT[move] : offer.used.includes(move) ? 'Already asked.' : 'Not applicable.'}</span>
              </button>
            {/each}
          </div>
        </section>
        <div class="row" style="justify-content:flex-end; gap:8px; margin-top:12px">
          <button class="danger ghost" onclick={() => { store.declineOffer(listingId); close(); }}>Walk away</button>
          <button class="primary" onclick={sign}>Sign — {formatMoney(offer.terms.baseSalary)}{offer.terms.grossPoints ? ` + ${offer.terms.grossPoints} pts` : ''}</button>
        </div>
      {:else}
        <div class="row" style="justify-content:flex-end; margin-top:12px"><button onclick={close}>Close</button></div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .read-text { font-style: italic; }
  .reply.accepted { border-color: var(--good); }
  .reply.withdrew { border-color: var(--bad); }
  .moves { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .move { text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; }
  .log { margin: 0; padding-left: 16px; font-size: 13px; }
</style>
