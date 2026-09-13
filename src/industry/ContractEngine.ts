/**
 * ContractEngine — the deal. Generates an offer's terms from the role and the player's standing,
 * models the studio's hidden position (patience) against the player's leverage, resolves each
 * counter as accept / counter / hold / withdraw, remembers how the player negotiated (studio deal
 * temper), and pays out backend at run end — where gross points have teeth and net points don't.
 */
import {
  clamp, type Agent, type BonusTier, type BoxOfficeRun, type ContractOffer, type ContractPayout, type ContractTerms,
  type CounterMove, type GameState, type Movie, type NegotiationEvent, type Role, type RoleType, type Studio,
  type StudioResponse, type WorkingSet, markDirty,
} from '../core/GameState';
import { rngFor, type Rng } from '../core/RNG';
import { agentEffects } from '../world/AgentEngine';
import { EXPECTED_STAR } from './CastingEngine';
import { tierIndex } from '../gen/MovieGen';

// ---------------------------------------------------------------------------
// Salary scaling (Part 1: Contract Salary Scaling — guidelines, not strict rules)
// ---------------------------------------------------------------------------

const GUIDELINE_BANDS: { minStar: number; lo: number; hi: number }[] = [
  { minStar: 90, lo: 12_000_000, hi: 40_000_000 },
  { minStar: 85, lo: 6_000_000, hi: 25_000_000 },
  { minStar: 80, lo: 1_500_000, hi: 10_000_000 },
  { minStar: 60, lo: 150_000, hi: 2_500_000 },
  { minStar: 40, lo: 5_000, hi: 250_000 },
  { minStar: 0, lo: 300, hi: 25_000 },
];

function roundMoney(n: number): number {
  const step = n >= 1_000_000 ? 50_000 : n >= 100_000 ? 5_000 : n >= 10_000 ? 500 : 100;
  return Math.max(step, Math.round(n / step) * step);
}

/** Union-scale floors: nobody works a speaking part for pocket change, whatever the budget. */
export const ROLE_SALARY_FLOOR: Record<RoleType, number> = {
  'Extra': 200, 'Minor': 600, 'Supporting': 1_500, 'Co-Lead': 3_000, 'Lead': 5_000, 'Main Protagonist': 6_000,
};

/** The most a film can pay one role as a share of its production budget — a star on an indie works for scale. */
export const BUDGET_SHARE_CAP: Record<RoleType, number> = {
  'Main Protagonist': 0.30, 'Lead': 0.25, 'Co-Lead': 0.15, 'Supporting': 0.08, 'Minor': 0.03, 'Extra': 0.01,
};

/**
 * What an actor of this star power commands for this role, within Part 1's guideline band, and
 * never more than the film's budget can carry (`budget` caps it; omit for a pure band lookup).
 */
export function salaryGuideline(starPower: number, role: Role, budget?: number): number {
  const starFactor = 0.5 + (starPower / 100) * 1.5;
  const band = GUIDELINE_BANDS.find((b) => starPower >= b.minStar)!;
  // Role size still matters inside the band: a Minor part for an A-lister isn't a lead's paycheck.
  const roleScale = { 'Main Protagonist': 1.1, 'Lead': 1, 'Co-Lead': 0.7, 'Supporting': 0.35, 'Minor': 0.12, 'Extra': 0.03 }[role.roleType];
  const raw = role.salary * starFactor;
  const unionFloor = ROLE_SALARY_FLOOR[role.roleType];
  let floor = Math.max(band.lo * roleScale, unionFloor);
  let ceiling = Math.max(band.hi * roleScale, floor);
  if (budget !== undefined) {
    const cap = Math.max(unionFloor, budget * BUDGET_SHARE_CAP[role.roleType]);
    ceiling = Math.min(ceiling, cap);
    floor = Math.min(floor, ceiling);
  }
  return roundMoney(clamp(raw, floor, ceiling));
}

// ---------------------------------------------------------------------------
// Offer generation
// ---------------------------------------------------------------------------

export interface OfferContext {
  direct: boolean;
  agent?: Agent;
  /** The player's casting fit for the role vs. the studio's best alternative (both 0–100-ish). */
  playerFit: number;
  bestAlternativeFit: number;
  careerGross: number;
}

function isLeadish(role: RoleType): boolean {
  return role === 'Lead' || role === 'Main Protagonist' || role === 'Co-Lead';
}

function backendEligible(starPower: number, movie: Movie, role: Role): boolean {
  return (starPower >= 70 && isLeadish(role.roleType)) || (starPower >= 85 && role.roleType === 'Supporting');
}

/** The hidden bargaining strength the player brings to this table (0–100). */
export function computeLeverage(state: GameState, movie: Movie, role: Role, ctx: OfferContext): number {
  const p = state.player;
  const expected = EXPECTED_STAR[movie.budgetTier];
  let lev = 30;
  lev += clamp((p.attributes.starPower - expected) * 0.8, -25, 30);
  lev += (p.attributes.negotiation - 50) * 0.3;
  lev += clamp(p.momentum * 0.2, -10, 15);
  lev += agentEffects(ctx.agent).leverageBonus;
  lev += clamp((ctx.playerFit - ctx.bestAlternativeFit) * 0.8, -15, 15);
  if (ctx.careerGross > 0) lev += clamp(Math.log10(ctx.careerGross / 1_000_000 + 1) * 4, 0, 12);
  if (ctx.direct) lev += 8;
  if (!isLeadish(role.roleType)) lev -= 6;
  return clamp(lev, 5, 95);
}

/** The hidden room the studio will give before walking (0–100). */
export function computePatience(state: GameState, ws: WorkingSet, movie: Movie, role: Role, ctx: OfferContext): number {
  const studio = ws.studios.get(movie.studioId) as Studio;
  const weeksToShoot = movie.productionStartWeek - state.week;
  let pat = 50;
  pat += weeksToShoot <= 3 ? 15 : weeksToShoot <= 6 ? 5 : 0; // close to cameras = desperate
  pat += (studio.playerRelationship - 50) * 0.3;
  pat += (studio.dealTemper - 50) * 0.4;
  const gap = ctx.playerFit - ctx.bestAlternativeFit;
  pat += gap > 8 ? 15 : gap < -5 ? -15 : 0; // strong alternatives = short fuse
  pat += tierIndex(movie.budgetTier) >= 3 ? 5 : 0; // bigger budgets have headroom
  if (ctx.direct) pat += 15;
  if (!isLeadish(role.roleType)) pat -= 5;
  return clamp(pat, 5, 95);
}

export function generateOffer(state: GameState, ws: WorkingSet, movie: Movie, role: Role, ctx: OfferContext): ContractOffer {
  const p = state.player;
  const studio = ws.studios.get(movie.studioId) as Studio;
  const rng = rngFor(state.worldSeed, movie.id, state.week, `offer:${role.id}`);
  const guideline = salaryGuideline(p.attributes.starPower, role, movie.budget);
  const temperFactor = 0.85 + studio.dealTemper / 500; // 0.85–1.05
  const baseSalary = roundMoney(guideline * temperFactor * (ctx.direct ? 1.15 : 1) * rng.multiplier(0.08));

  const bonuses: BonusTier[] = [];
  if (tierIndex(movie.budgetTier) >= 2 && isLeadish(role.roleType)) {
    bonuses.push({ multiple: 2.0, amount: roundMoney(baseSalary * 0.25) });
  }
  const grossPoints = backendEligible(p.attributes.starPower, movie, role) ? (p.attributes.starPower >= 88 ? 2 : 1) : 0;
  const rank = { 'Main Protagonist': 1, 'Lead': 1, 'Co-Lead': 2, 'Supporting': 4, 'Minor': 6, 'Extra': 8 }[role.roleType];
  const sequelChance = studio.identity === 'blockbuster' ? 0.6 : studio.identity === 'genre' ? 0.4 : 0.15;
  const sequelOption = isLeadish(role.roleType) && rng.chance(sequelChance);
  const terms: ContractTerms = {
    baseSalary,
    bonuses,
    grossPoints,
    netPoints: 0,
    billing: rank,
    sequelOption,
    sequelOptionRate: sequelOption ? roundMoney(baseSalary * 1.3) : undefined,
    promoWeeks: tierIndex(movie.budgetTier) >= 3 ? 3 : tierIndex(movie.budgetTier) >= 2 ? 2 : 1,
    payOrPlay: false,
  };
  const patience = computePatience(state, ws, movie, role, ctx);
  const leverage = computeLeverage(state, movie, role, ctx);
  return {
    terms,
    original: structuredClone(terms),
    round: 0,
    maxRounds: 3,
    patience,
    leverage,
    status: 'open',
    log: [],
    agentRead: agentRead(patience, ctx.agent, rng),
    used: [],
  };
}

/** Your agent's read of the room — blurred by how good they are. Without one, you're guessing. */
export function agentRead(patience: number, agent: Agent | undefined, rng: Rng): string {
  const accuracy = agentEffects(agent).readAccuracy;
  const perceived = clamp(patience + rng.variance((1 - accuracy) * 45), 0, 100);
  const who = agent ? `${agent.firstName}` : 'Your gut';
  if (!agent) {
    return `${who} says: no representation, so you're reading tea leaves. ${perceived >= 55 ? 'They seemed keen enough.' : 'They seemed lukewarm.'}`;
  }
  if (perceived < 30) return `${who}: "They have other names in mind. Take it or lose it."`;
  if (perceived < 50) return `${who}: "They'd rather not haggle. One ask, maybe."`;
  if (perceived < 70) return `${who}: "There's room here if you push — once or twice."`;
  return `${who}: "They want you. Push."`;
}

// ---------------------------------------------------------------------------
// Negotiation
// ---------------------------------------------------------------------------

export const COUNTER_LABEL: Record<CounterMove, string> = {
  higher_salary: 'Ask for a higher salary',
  backend: 'Ask for backend',
  top_billing: 'Ask for top billing',
  drop_sequel: 'Drop the sequel option',
  pay_or_play: 'Ask for pay-or-play',
};

export function counterAvailable(offer: ContractOffer, move: CounterMove): boolean {
  if (offer.status !== 'open' || offer.used.includes(move)) return false;
  if (move === 'top_billing' && offer.terms.billing === 1) return false;
  if (move === 'drop_sequel' && !offer.terms.sequelOption) return false;
  if (move === 'pay_or_play' && offer.terms.payOrPlay) return false;
  return true;
}

/** How much a demand costs the studio's patience; some asks are far pricier than others. */
function moveCost(move: CounterMove, state: GameState, ws: WorkingSet, movie: Movie, role: Role): number {
  switch (move) {
    case 'higher_salary': return 12;
    case 'backend': return backendEligible(state.player.attributes.starPower, movie, role) ? 18 : 16;
    case 'top_billing': {
      const top = movie.cast.slice().sort((a, b) => a.billing - b.billing)[0];
      const topStar = top ? (ws.people.get(top.personId)?.attributes.starPower ?? 0) : 0;
      return topStar > state.player.attributes.starPower + 10 ? 26 : 10;
    }
    case 'drop_sequel': return 8;
    case 'pay_or_play': return 10;
  }
}

function applyAsk(terms: ContractTerms, move: CounterMove, full: boolean, eligible: boolean): string {
  switch (move) {
    case 'higher_salary': {
      const pct = full ? 0.18 : 0.08;
      terms.baseSalary = roundMoney(terms.baseSalary * (1 + pct));
      return `base salary up ${Math.round(pct * 100)}% to $${terms.baseSalary.toLocaleString()}`;
    }
    case 'backend': {
      if (eligible) {
        const pts = full ? 1.5 : 0.75;
        terms.grossPoints = Math.round((terms.grossPoints + pts) * 100) / 100;
        return `${pts} gross points from dollar one (${terms.grossPoints} total)`;
      }
      if (full) {
        terms.bonuses.push({ multiple: 1.5, amount: roundMoney(terms.baseSalary * 0.2) });
        return `a box-office bonus: $${terms.bonuses[terms.bonuses.length - 1].amount.toLocaleString()} if the film does 1.5× its budget`;
      }
      // The trap: net points sound like backend and pay like a rounding error.
      terms.netPoints = Math.round((terms.netPoints + 2) * 100) / 100;
      return `2 net points — "a piece of the profits"`;
    }
    case 'top_billing': {
      terms.billing = full ? 1 : Math.min(terms.billing, 2);
      return full ? 'top billing' : 'second billing';
    }
    case 'drop_sequel': {
      if (full) { terms.sequelOption = false; terms.sequelOptionRate = undefined; return 'the sequel option removed'; }
      terms.sequelOptionRate = roundMoney((terms.sequelOptionRate ?? terms.baseSalary) * 1.6);
      return `a better sequel rate ($${terms.sequelOptionRate.toLocaleString()}) but the option stays`;
    }
    case 'pay_or_play': {
      terms.payOrPlay = true;
      return 'pay-or-play: you get paid even if the film collapses';
    }
  }
}

/**
 * The player pushes on one term. The studio accepts, meets halfway, holds firm, or walks —
 * and remembers how it went.
 */
export function counterOffer(state: GameState, ws: WorkingSet, movie: Movie, role: Role, offer: ContractOffer, move: CounterMove): NegotiationEvent {
  if (!counterAvailable(offer, move)) throw new Error('That ask is not available.');
  const studio = ws.studios.get(movie.studioId) as Studio;
  const rng = rngFor(state.worldSeed, movie.id, state.week, `nego:${role.id}:${offer.round}`);
  const cost = moveCost(move, state, ws, movie, role);
  const eligible = backendEligible(state.player.attributes.starPower, movie, role);
  offer.round += 1;
  offer.used.push(move);

  let response: StudioResponse;
  let text: string;
  if (offer.round > offer.maxRounds) {
    response = 'withdrew';
    text = `${studio.name} has stopped taking your calls. The offer is withdrawn.`;
  } else {
    // Each ask lands on a more tired room: the second and third pushes cost more and are heard less.
    const fatigue = (offer.round - 1) * 8;
    const score = offer.leverage - cost * (1 + 0.35 * (offer.round - 1)) - fatigue + (offer.patience - 50) / 2 + rng.variance(15) - 18;
    if (score > 15) {
      response = 'accepted';
      text = `${studio.name} agrees: ${applyAsk(offer.terms, move, true, eligible)}.`;
    } else if (score > -5) {
      response = 'countered';
      text = `${studio.name} meets you halfway: ${applyAsk(offer.terms, move, false, eligible)}.`;
    } else if (score > -20 && offer.patience - cost > 10) {
      response = 'held';
      text = `${studio.name} holds firm. "The offer stands as it is."`;
    } else {
      response = 'withdrew';
      text = rng.pick([
        `${studio.name} pulls the offer. "We'll go another way."`,
        `Silence, then a short email: the role has gone to someone else.`,
        `"We appreciate the interest." ${studio.name} withdraws.`,
      ]);
    }
  }
  offer.patience = clamp(offer.patience - cost * 0.7, 0, 100);
  if (response === 'withdrew') {
    offer.status = 'withdrawn';
    studio.dealTemper = clamp(studio.dealTemper - 8, 0, 100);
    markDirty(ws, 'studios', studio.id);
  }
  const ev: NegotiationEvent = { round: offer.round, move, response, text };
  offer.log.push(ev);
  return ev;
}

/** Signing: the studio remembers whether you were easy or hard to close. */
export function recordSigning(ws: WorkingSet, movie: Movie, offer: ContractOffer): void {
  const studio = ws.studios.get(movie.studioId);
  if (!studio) return;
  const delta = offer.round === 0 ? 2 : offer.round === 1 ? 0 : -3;
  studio.dealTemper = clamp(studio.dealTemper + delta, 0, 100);
  markDirty(ws, 'studios', studio.id);
  offer.status = 'accepted';
}

// ---------------------------------------------------------------------------
// Payout
// ---------------------------------------------------------------------------

/** Backend at run end. Base salary was paid on wrap. */
export function computePayout(terms: ContractTerms, run: BoxOfficeRun, movie: Movie, agent: Agent | undefined): ContractPayout {
  const ratio = run.worldwide / movie.budget;
  let bonus = 0;
  for (const b of terms.bonuses) if (ratio >= b.multiple) bonus += b.amount;
  const gross = Math.round((terms.grossPoints / 100) * run.worldwide);
  // "Net profit" after the studio's share, prints & ads, overhead and interest — usually nothing.
  const studioReceipts = run.worldwide * 0.45;
  const costs = (movie.budget + movie.marketingBudget) * 1.6;
  const netProfit = Math.max(0, studioReceipts - costs);
  const net = Math.round((terms.netPoints / 100) * netProfit * 0.2);
  const subtotal = bonus + gross + net;
  const commission = agent ? Math.round(subtotal * agent.commission) : 0;
  return { bonus, gross, net, commission, total: subtotal - commission };
}

export function describeTerms(t: ContractTerms): string[] {
  const out = [`Base $${t.baseSalary.toLocaleString()}`];
  for (const b of t.bonuses) out.push(`+$${b.amount.toLocaleString()} if ≥${b.multiple}× budget`);
  if (t.grossPoints) out.push(`${t.grossPoints} gross pts`);
  if (t.netPoints) out.push(`${t.netPoints} net pts`);
  out.push(`Billing #${t.billing}`);
  if (t.sequelOption) out.push(`Sequel option @ $${(t.sequelOptionRate ?? 0).toLocaleString()}`);
  if (t.payOrPlay) out.push('Pay-or-play');
  return out;
}
