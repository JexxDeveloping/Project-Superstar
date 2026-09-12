/**
 * Longevity: a 30-year player career driven by a simple policy. The systems must keep working,
 * the career must actually progress, hot state must stay bounded, and ticks must stay fast.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { APPLICATION_HISTORY_CAP } from '../core/TimeEngine';
import type { BudgetTier, RoleType } from '../core/GameState';

const spec = { firstName: 'Long', lastName: 'Haul', gender: 'female' as const, background: 'Theater Actor' as const, archetype: 'Dramatic Performer' as const };
const ROLE_RANK: RoleType[] = ['Extra', 'Minor', 'Supporting', 'Co-Lead', 'Lead', 'Main Protagonist'];

function playYears(seed: string, years: number) {
  const game = Game.create({ player: spec, seed });
  const s = game.state;
  const byDecade: { tier: BudgetTier; role: RoleType; star: number }[][] = [];
  let ticksMs = 0;
  for (let w = 0; w < years * 52; w++) {
    const p = s.player;
    for (const id of s.agentApproaches) { try { game.hireAgent(id); } catch { /* floor */ } }
    if (!p.agentId) for (const a of s.agents.slice().sort((x, y) => y.level - x.level)) { try { game.hireAgent(a.id); break; } catch { /* floor */ } }
    for (const app of s.applications) {
      if (app.status === 'audition_pending' && !app.prep) game.choosePrep(app.listingId, 'Practice Scene');
      if (app.status === 'offer' && app.contract?.status === 'open') {
        if (app.contract.round === 0) { try { game.counterOffer(app.listingId, 'higher_salary'); } catch { /* n/a */ } }
        if (app.contract.status === 'withdrawn') continue;
        try { game.acceptOffer(app.listingId); } catch { game.declineOffer(app.listingId); }
      }
    }
    const ranked = s.listings.slice().sort((a, b) => ROLE_RANK.indexOf(b.roleType) - ROLE_RANK.indexOf(a.roleType));
    for (const l of ranked) { if (game.actionsRemaining <= 1) break; try { game.planAction({ type: 'apply', listingId: l.id }); } catch { /* blocked */ } }
    if (game.actionsRemaining > 0 && (p.energy < 50 || p.stress > 55)) game.planAction({ type: 'rest' });
    while (game.actionsRemaining > 0) {
      if (!s.activeProduction && p.cash > 2000) { try { game.planAction({ type: 'acting_class' }); continue; } catch { /* cash */ } }
      game.planAction({ type: 'prepare_role' });
    }
    const t0 = performance.now();
    game.endWeek();
    ticksMs += performance.now() - t0;
    while (s.pendingResults.length) {
      const r = s.pendingResults[0];
      const d = Math.floor(w / 520);
      (byDecade[d] ??= []).push({ tier: game.ws.movies.get(r.movieId)!.budgetTier, role: r.roleType, star: p.attributes.starPower });
      game.dismissResult();
    }
  }
  return { game, byDecade, avgTickMs: ticksMs / (years * 52) };
}

describe('A 30-year career', () => {
  const { game, byDecade, avgTickMs } = playYears('career-test', 30);
  const s = game.state;

  it('progresses: more star power and craft, real money, agents, direct offers', () => {
    expect(s.player.attributes.starPower).toBeGreaterThan(60);
    expect(s.player.attributes.acting).toBeGreaterThan(65);
    expect(s.player.attributes.acting).toBeLessThan(96); // 95–100 stays extremely hard
    expect(s.player.filmography.length).toBeGreaterThan(30);
    expect(s.player.careerEarnings).toBeGreaterThan(5_000_000);
    expect(s.player.backendEarnings).toBeGreaterThan(0);
    expect(s.player.agentId).toBeDefined();
    expect(s.player.headToHead.length).toBeGreaterThan(50);
  });

  it('graduates: once a name, the work is leads on real films, not indie bit parts', () => {
    const last = byDecade[byDecade.length - 1] ?? [];
    const asName = last.filter((f) => f.star >= 85);
    expect(asName.length).toBeGreaterThan(5);
    const bitParts = asName.filter((f) => (f.tier === 'Micro Indie' || f.tier === 'Indie') && (f.role === 'Minor' || f.role === 'Supporting'));
    expect(bitParts.length).toBe(0);
    const leads = asName.filter((f) => f.role === 'Lead' || f.role === 'Main Protagonist' || f.role === 'Co-Lead');
    expect(leads.length / asName.length).toBeGreaterThan(0.6);
  });

  it('keeps hot state bounded and ticks fast', () => {
    const live = s.applications.filter((a) => ['applied', 'audition_pending', 'offer', 'booked', 'in_production'].includes(a.status)).length;
    expect(s.applications.length).toBeLessThanOrEqual(APPLICATION_HISTORY_CAP + live + 5);
    expect(s.timeline.length).toBeLessThanOrEqual(1500);
    expect(JSON.stringify(s).length).toBeLessThan(2_000_000);
    expect(avgTickMs).toBeLessThan(15);
  });
});
