/**
 * Phase 3: contracts, negotiation, agents, direct offers, scripts, cancellations, head-to-head.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import type { BoxOfficeRun, ContractTerms, Movie, Role } from '../core/GameState';
import { computePayout, counterAvailable, counterOffer, generateOffer, salaryGuideline } from '../industry/ContractEngine';
import { callbackProbability, directOfferChance, findDirectOffer, trackRecord } from '../industry/CastingEngine';
import { agentEffects, hireAgent, hireBlockedReason } from '../world/AgentEngine';
import { attachPerson, tickCancellations } from '../industry/MovieEngine';
import { DAY_JOBS, dayJobById } from '../sim/ActorEngine';
import { EventBus } from '../core/EventBus';

const spec = { firstName: 'Deal', lastName: 'Maker', gender: 'female' as const, background: 'Film Student' as const, archetype: 'Dramatic Performer' as const };

function castingMovie(game: Game, minTier = 0, exclude: string[] = [], maxTier = 5): { movie: Movie; role: Role } {
  const tiers = ['Micro Indie', 'Indie', 'Small Studio', 'Medium', 'Large', 'Tentpole'];
  const open = (m: Movie) => m.status === 'casting' && !exclude.includes(m.id) && m.roles.some((r) => !r.castPersonId && (r.roleType === 'Lead' || r.roleType === 'Co-Lead'));
  const all = [...game.ws.movies.values()];
  const movie = all.find((m) => open(m) && tiers.indexOf(m.budgetTier) >= minTier && tiers.indexOf(m.budgetTier) <= maxTier) ?? all.find(open);
  if (!movie) throw new Error('no casting movie with an open lead');
  const role = movie.roles.find((r) => !r.castPersonId && (r.roleType === 'Lead' || r.roleType === 'Co-Lead'))!;
  return { movie, role };
}

function ctxFor(_game: Game, _movie: Movie, _role: Role, direct = false) {
  return { direct, agent: undefined, playerFit: 50, bestAlternativeFit: 50, careerGross: 0 };
}

describe('Salary guidelines (Part 1 scaling)', () => {
  const role = (salary: number, roleType: Role['roleType']): Role => ({ id: 'r', characterName: 'X', roleType, genderPref: 'any', ageMin: 18, ageMax: 60, requiredActing: 40, difficulty: 40, salary });
  it('keeps an unknown in the hundreds-to-thousands and a superstar in the tens of millions', () => {
    expect(salaryGuideline(10, role(3_000, 'Lead'))).toBeLessThanOrEqual(25_000);
    expect(salaryGuideline(10, role(8_000_000, 'Lead'))).toBeLessThanOrEqual(25_000);
    expect(salaryGuideline(92, role(8_000_000, 'Lead'))).toBeGreaterThanOrEqual(12_000_000);
    expect(salaryGuideline(92, role(8_000_000, 'Lead'))).toBeLessThanOrEqual(40_000_000);
    expect(salaryGuideline(82, role(1_200_000, 'Lead'))).toBeGreaterThanOrEqual(1_500_000);
  });
  it('never pays a speaking part pocket change', () => {
    expect(salaryGuideline(5, role(240, 'Minor'))).toBeGreaterThanOrEqual(600);
    expect(salaryGuideline(5, role(750, 'Supporting'))).toBeGreaterThanOrEqual(1_500);
    expect(salaryGuideline(5, role(3_000, 'Lead'))).toBeGreaterThanOrEqual(5_000);
  });
  it('scales down for smaller parts inside the band', () => {
    expect(salaryGuideline(85, role(8_000_000 * 0.08, 'Minor'))).toBeLessThan(salaryGuideline(85, role(8_000_000, 'Lead')));
  });
});

describe('Payouts', () => {
  const movie = { budget: 50_000_000, marketingBudget: 50_000_000 } as Movie;
  const run = (worldwide: number): BoxOfficeRun => ({ weeks: [], openingDomestic: 0, openingInternational: 0, totalDomestic: worldwide, totalInternational: 0, worldwide, finished: true });
  const base: ContractTerms = { baseSalary: 1_000_000, bonuses: [{ multiple: 2, amount: 250_000 }], grossPoints: 0, netPoints: 0, billing: 1, sequelOption: false, promoWeeks: 2, payOrPlay: false };
  it('bonus tiers pay only when the multiple is reached', () => {
    expect(computePayout(base, run(90_000_000), movie, undefined).bonus).toBe(0);
    expect(computePayout(base, run(110_000_000), movie, undefined).bonus).toBe(250_000);
  });
  it('gross points have teeth; net points pay almost nothing on the same film', () => {
    const gross = computePayout({ ...base, bonuses: [], grossPoints: 2 }, run(300_000_000), movie, undefined);
    const net = computePayout({ ...base, bonuses: [], netPoints: 2 }, run(300_000_000), movie, undefined);
    expect(gross.gross).toBe(6_000_000);
    expect(net.net).toBeLessThan(gross.gross * 0.05);
    const flop = computePayout({ ...base, bonuses: [], netPoints: 5 }, run(80_000_000), movie, undefined);
    expect(flop.net).toBe(0);
  });
  it('the agent takes commission off backend', () => {
    const agent = { id: 'a', firstName: 'A', lastName: 'B', agency: 'X', level: 3, connections: 60, negotiation: 60, commission: 0.1, specialization: 'general' as const, minStarPower: 0 };
    const p = computePayout({ ...base, bonuses: [], grossPoints: 1 }, run(100_000_000), movie, agent);
    expect(p.commission).toBe(100_000);
    expect(p.total).toBe(900_000);
  });
});

describe('Negotiation', () => {
  function pushThreeTimes(seed: string, starPower: number): { withdrawn: boolean; salaryUp: boolean } {
    const game = Game.create({ player: spec, seed, prehistoryWeeks: 20 });
    const s = game.state;
    s.player.attributes.starPower = starPower;
    s.player.attributes.negotiation = starPower >= 70 ? 70 : 25;
    // Tier-appropriate rooms: a rookie negotiating an indie lead, a star negotiating a studio lead.
    const { movie, role } = starPower >= 70 ? castingMovie(game, 2) : castingMovie(game, 0, [], 1);
    const offer = generateOffer(s, game.ws, movie, role, ctxFor(game, movie, role));
    const start = offer.terms.baseSalary;
    for (const move of ['higher_salary', 'backend', 'top_billing'] as const) {
      if (offer.status !== 'open') break;
      if (move === 'top_billing' && offer.terms.billing === 1) continue;
      counterOffer(s, game.ws, movie, role, offer, move);
    }
    return { withdrawn: offer.status === 'withdrawn', salaryUp: offer.terms.baseSalary > start };
  }
  it('greed at low leverage loses the role a meaningful share of the time; high leverage rarely does', () => {
    const N = 30;
    let lowWithdrawn = 0; let highWithdrawn = 0; let anyRaise = 0;
    for (let i = 0; i < N; i++) {
      const low = pushThreeTimes(`nego-low-${i}`, 12);
      const high = pushThreeTimes(`nego-high-${i}`, 88);
      if (low.withdrawn) lowWithdrawn++;
      if (high.withdrawn) highWithdrawn++;
      if (low.salaryUp || high.salaryUp) anyRaise++;
    }
    expect(lowWithdrawn / N).toBeGreaterThan(0.15);
    expect(lowWithdrawn / N).toBeLessThan(0.8);
    expect(highWithdrawn / N).toBeLessThan(0.15);
    expect(anyRaise).toBeGreaterThan(0);
  });
  it('a fourth ask after three rounds always ends the talks; used moves cannot repeat', () => {
    const game = Game.create({ player: spec, seed: 'nego-rounds', prehistoryWeeks: 20 });
    const s = game.state;
    s.player.attributes.starPower = 90; s.player.attributes.negotiation = 90; s.player.momentum = 60;
    const { movie, role } = castingMovie(game, 3);
    const offer = generateOffer(s, game.ws, movie, role, { direct: true, agent: undefined, playerFit: 80, bestAlternativeFit: 40, careerGross: 500_000_000 });
    offer.patience = 95; // a studio that will not walk early, so we reach the round cap
    offer.terms.sequelOption = true; offer.terms.sequelOptionRate = 1_000_000; offer.terms.billing = 2; // make every ask available
    expect(() => counterOffer(s, game.ws, movie, role, offer, 'higher_salary')).not.toThrow();
    expect(() => counterOffer(s, game.ws, movie, role, offer, 'higher_salary')).toThrow();
    const moves = ['backend', 'pay_or_play', 'top_billing', 'drop_sequel'] as const;
    let last = offer.log[offer.log.length - 1];
    for (const move of moves) {
      if (offer.status !== 'open') break;
      if (!counterAvailable(offer, move)) continue;
      last = counterOffer(s, game.ws, movie, role, offer, move);
    }
    expect(offer.round).toBeGreaterThanOrEqual(offer.maxRounds);
    expect(offer.status).toBe('withdrawn');
    expect(last.response).toBe('withdrew');
  });
  it('the studio remembers: a withdrawn negotiation lowers its deal temper', () => {
    const game = Game.create({ player: spec, seed: 'nego-memory', prehistoryWeeks: 20 });
    const s = game.state;
    s.player.attributes.starPower = 8;
    const { movie, role } = castingMovie(game);
    const studio = game.ws.studios.get(movie.studioId)!;
    const before = studio.dealTemper;
    let withdrawn = false;
    for (let i = 0; i < 6 && !withdrawn; i++) {
      const offer = generateOffer(s, game.ws, movie, role, { ...ctxFor(game, movie, role), bestAlternativeFit: 80 });
      offer.patience = 5;
      for (const move of ['higher_salary', 'backend', 'top_billing', 'drop_sequel', 'pay_or_play'] as const) {
        if (offer.status !== 'open') break;
        try { counterOffer(s, game.ws, movie, role, offer, move); } catch { /* unavailable */ }
      }
      withdrawn = offer.status === 'withdrawn';
      s.week += 1;
    }
    expect(withdrawn).toBe(true);
    expect(studio.dealTemper).toBeLessThan(before);
  });
});

describe('Casting v2, agents, direct offers', () => {
  it('a strong track record and an agent raise callback odds', () => {
    const game = Game.create({ player: spec, seed: 'cast-v2', prehistoryWeeks: 20 });
    const s = game.state;
    const l = s.listings[0] ?? (() => { throw new Error('no listing'); })();
    const movie = game.ws.movies.get(l.movieId)!;
    const director = game.ws.directors.get(movie.directorId)!;
    const studio = game.ws.studios.get(movie.studioId)!;
    const base = { competitionGap: 0, record: trackRecord(s.player, game.ws), agentBonus: 0 };
    const p0 = callbackProbability(s.player, l, movie, director, studio, base);
    const p1 = callbackProbability(s.player, l, movie, director, studio, { ...base, record: { avgPerformance: 4.5, avgVerdictRank: 4, films: 3 } });
    const p2 = callbackProbability(s.player, l, movie, director, studio, { ...base, agentBonus: agentEffects(s.agents[5]).callbackBonus });
    const p3 = callbackProbability(s.player, l, movie, director, studio, { ...base, competitionGap: 20 });
    expect(p1).toBeGreaterThan(p0);
    expect(p2).toBeGreaterThan(p0);
    expect(p3).toBeLessThan(p0);
  });
  it('elite agencies refuse unknowns; boutiques sign them; an approach overrides the floor', () => {
    const game = Game.create({ player: spec, seed: 'agents-1', prehistoryWeeks: 20 });
    const s = game.state;
    const boutique = s.agents.find((a) => a.level === 1)!;
    const elite = s.agents.find((a) => a.level === 5)!;
    expect(hireBlockedReason(s.player, boutique, false)).toBeNull();
    expect(hireBlockedReason(s.player, elite, false)).toMatch(/doesn't take clients/);
    expect(() => hireAgent(s, elite.id)).toThrow();
    s.agentApproaches.push(elite.id);
    expect(() => hireAgent(s, elite.id)).not.toThrow();
    expect(s.player.agentId).toBe(elite.id);
    expect(s.agentApproaches).not.toContain(elite.id);
  });
  it('direct offers never come to unknowns and do come to names', () => {
    expect(directOfferChance(30)).toBe(0);
    const unknown = Game.create({ player: spec, seed: 'direct-1', prehistoryWeeks: 20 });
    for (let w = 0; w < 40; w++) { unknown.planAction({ type: 'rest' }); unknown.endWeek(); }
    expect(unknown.state.applications.some((a) => a.source === 'direct')).toBe(false);

    const name = Game.create({ player: spec, seed: 'direct-2', prehistoryWeeks: 20 });
    const p = name.state.player;
    p.attributes.starPower = 88; p.attributes.acting = 85;
    for (const g of Object.keys(p.genres) as (keyof typeof p.genres)[]) p.genres[g] = 80;
    let sawDirect = false;
    for (let w = 0; w < 40 && !sawDirect; w++) {
      name.planAction({ type: 'rest' });
      name.endWeek();
      for (const a of name.state.applications) if (a.status === 'offer') name.declineOffer(a.listingId);
      sawDirect = name.state.applications.some((a) => a.source === 'direct');
      p.attributes.starPower = 88; // hold the name steady for the test
    }
    expect(sawDirect).toBe(true);
    const direct = name.state.applications.find((a) => a.source === 'direct')!;
    expect(direct.contract?.terms.baseSalary).toBeGreaterThan(0);
    void findDirectOffer;
  });
});

describe('Scripts, head-to-head, cancellations, pay-or-play', () => {
  it('reading a script narrows the bands and is remembered on the listing', () => {
    const game = Game.create({ player: spec, seed: 'scripts-1', prehistoryWeeks: 20 });
    const s = game.state;
    const l = s.listings.slice().sort((a, b) => b.expiresWeek - a.expiresWeek)[0];
    expect(l.expiresWeek).toBeGreaterThan(s.week + 1);
    game.planAction({ type: 'read_script', listingId: l.id });
    expect(() => game.planAction({ type: 'read_script', listingId: l.id })).toThrow();
    game.endWeek();
    const after = s.listings.find((x) => x.id === l.id);
    expect(after?.scriptRead).toBe(true);
    expect(s.weeklyReport.some((e) => e.title.startsWith('Read the script'))).toBe(true);
  });

  it('every audition logs head-to-head records against named competitors', () => {
    const game = Game.create({ player: spec, seed: 'h2h-1', prehistoryWeeks: 20 });
    const s = game.state;
    for (let i = 0; i < 40 && s.player.headToHead.length === 0; i++) {
      for (const l of s.listings) { try { game.planAction({ type: 'apply', listingId: l.id }); } catch { /* full */ } }
      for (const a of s.applications) if (a.status === 'audition_pending' && !a.prep) game.choosePrep(a.listingId, 'Practice Scene');
      game.endWeek();
    }
    expect(s.player.headToHead.length).toBeGreaterThan(0);
    const rec = s.player.headToHead[0];
    expect(game.ws.people.has(rec.personId)).toBe(true);
    expect(typeof rec.won).toBe('boolean');
  });

  it('a cancelled film frees the player, and pay-or-play pays out', () => {
    const game = Game.create({ player: spec, seed: 'cancel-1', prehistoryWeeks: 20 });
    const s = game.state;
    const terms: ContractTerms = { baseSalary: 5_000, bonuses: [], grossPoints: 0, netPoints: 0, billing: 1, sequelOption: false, promoWeeks: 1, payOrPlay: true };
    const booked: string[] = [];
    const book = (payOrPlay: boolean) => {
      const { movie, role } = castingMovie(game, 0, booked);
      booked.push(movie.id);
      attachPerson(game.ws, movie, s.player, role, 5_000);
      s.trackedMovieIds.push(movie.id);
      const t = { ...terms, payOrPlay };
      s.applications.push({ listingId: `l-${role.id}`, movieId: movie.id, roleId: role.id, movieTitle: movie.title, characterName: role.characterName, roleType: role.roleType, appliedWeek: s.week, status: 'booked', source: 'audition', contract: { terms: t, original: t, round: 0, maxRounds: 3, patience: 50, leverage: 50, status: 'accepted', log: [], agentRead: '', used: [] } });
      return movie;
    };
    const paid = book(true);
    const unpaid = book(false);
    // Kill both the way the engine does (status + bookkeeping); the orchestrator resolves the player's side next tick.
    for (const m of [paid, unpaid]) {
      m.status = 'cancelled'; m.cancelledWeek = s.week; m.cancelledReason = 'financing fell through';
      for (const c of m.cast) { const p = game.ws.people.get(c.personId)!; p.activeMovieIds = p.activeMovieIds.filter((id) => id !== m.id); }
    }
    const cashBefore = s.player.cash;
    game.planAction({ type: 'rest' });
    game.endWeek();
    for (const a of s.applications) expect(a.status).toBe('expired');
    expect(paid.id).not.toBe(unpaid.id);
    expect(s.trackedMovieIds).toEqual([]);
    expect(s.player.activeMovieIds).toEqual([]);
    expect(s.player.cash).toBe(cashBefore - s.weeklyExpenses + dayJobById(s.dayJob)!.pay + 5_000);
    expect(s.weeklyReport.some((e) => e.title.includes('get paid anyway'))).toBe(true);
    expect(s.weeklyReport.some((e) => e.description.includes('No shoot, no paycheck'))).toBe(true);
    void tickCancellations; void EventBus;
    // And the player is free to work again.
    const next = castingMovie(game);
    expect(next.movie.status).toBe('casting');
  });
});

describe('Rookie economy', () => {
  it('every day job covers the rent with cash to spare; it pauses on a set; you can quit', () => {
    for (const j of DAY_JOBS) {
      expect(j.pay - 250).toBeGreaterThanOrEqual(100);
      expect(j.energy).toBeGreaterThanOrEqual(15);
      expect(j.energy).toBeLessThanOrEqual(25);
    }
    const game = Game.create({ player: spec, seed: 'economy-1', prehistoryWeeks: 20 });
    const s = game.state;
    expect(s.dayJob).toBe('cafe');
    const before = s.player.cash;
    const energyBefore = s.player.energy;
    game.planAction({ type: 'prepare_role' });
    game.endWeek();
    expect(s.player.cash).toBe(before - s.weeklyExpenses + dayJobById('cafe')!.pay);
    expect(s.player.energy).toBeLessThan(energyBefore);
    game.takeDayJob('warehouse');
    const c2 = s.player.cash;
    game.planAction({ type: 'prepare_role' }); game.endWeek();
    expect(s.player.cash).toBe(c2 - s.weeklyExpenses + 550);
    game.quitDayJob();
    expect(s.dayJob).toBeNull();
    const c3 = s.player.cash;
    game.planAction({ type: 'prepare_role' }); game.endWeek();
    expect(s.player.cash).toBe(c3 - s.weeklyExpenses);
    game.takeDayJob('bar');
    // On a set there is no day job (the salary is the income).
    const { movie, role } = castingMovie(game);
    attachPerson(game.ws, movie, s.player, role, 5_000);
    s.applications.push({ listingId: `l-${role.id}`, movieId: movie.id, roleId: role.id, movieTitle: movie.title, characterName: role.characterName, roleType: role.roleType, appliedWeek: s.week, status: 'booked', source: 'audition' });
    s.trackedMovieIds.push(movie.id);
    for (const r of movie.roles) if (!r.castPersonId) r.castPersonId = 'ghost';
    movie.status = 'pre-production'; movie.productionStartWeek = s.week + 1;
    game.planAction({ type: 'rest' }); game.endWeek(); // shoot starts
    expect(s.activeProduction?.movieId).toBe(movie.id);
    const onSet = s.player.cash;
    game.planAction({ type: 'prepare_role' }); game.endWeek();
    expect(s.player.cash).toBe(onSet - s.weeklyExpenses);
  });

  it('the board quotes the same salary the contract opens near', () => {
    const game = Game.create({ player: spec, seed: 'economy-2', prehistoryWeeks: 20 });
    const s = game.state;
    for (const l of s.listings) {
      const movie = game.ws.movies.get(l.movieId)!;
      const role = movie.roles.find((r) => r.id === l.roleId)!;
      expect(l.expectedSalary).toBe(salaryGuideline(s.player.attributes.starPower, role));
      expect(l.expectedSalary).toBeGreaterThanOrEqual(600);
    }
  });
});
