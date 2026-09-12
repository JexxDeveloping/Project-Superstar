/**
 * AgentEngine — representation. A seeded roster of agents across agency tiers; hiring rules
 * (elite agencies refuse unknowns); agents approaching a hot player; and the effects an agent has
 * on a career: which rooms you hear about, callback odds, bargaining leverage, and how well they
 * read a studio during negotiation. Commission comes off salary and backend.
 *
 * Phase 3 scope: the player only. NPC representation is invisible to the player and skipped.
 */
import { clamp, fullName, type Agent, type GameState, type Genre, type Id, type Person } from '../core/GameState';
import { rngFor } from '../core/RNG';
import type { EventBus } from '../core/EventBus';
import { generatePersonName } from '../gen/NameGen';

interface AgencySpec { agency: string; level: number; minStarPower: number; commission: number; count: number }
const AGENCIES: AgencySpec[] = [
  { agency: 'Bluebird Reps', level: 1, minStarPower: 0, commission: 0.10, count: 2 },
  { agency: 'Kessler-Park Management', level: 1, minStarPower: 0, commission: 0.10, count: 1 },
  { agency: 'Northgate Talent', level: 2, minStarPower: 25, commission: 0.10, count: 2 },
  { agency: 'Silver Talent Agency', level: 3, minStarPower: 45, commission: 0.12, count: 2 },
  { agency: 'Meridian Artists', level: 4, minStarPower: 62, commission: 0.15, count: 2 },
  { agency: 'Apex Creative', level: 5, minStarPower: 78, commission: 0.15, count: 1 },
];
const SPECIALIZATIONS: (Genre | 'general')[] = ['general', 'general', 'Drama', 'Comedy', 'Action', 'Horror', 'Romance', 'Thriller'];

export const LEVEL_LABEL: Record<number, string> = { 1: 'Boutique', 2: 'Mid-size', 3: 'Major', 4: 'Top agency', 5: 'Elite' };

/** The universe's agent roster. Deterministic per worldSeed. */
export function generateAgents(universeId: Id, worldSeed: number): Agent[] {
  const rng = rngFor(worldSeed, 'agents', 0, 'roster');
  const names = new Set<string>();
  const out: Agent[] = [];
  let n = 0;
  for (const spec of AGENCIES) {
    for (let i = 0; i < spec.count; i++) {
      n += 1;
      const gender = rng.pick(['male', 'female'] as const);
      const name = generatePersonName(rng, gender, names);
      out.push({
        id: `a-${n}`,
        firstName: name.firstName,
        lastName: name.lastName,
        agency: spec.agency,
        level: spec.level,
        connections: clamp(30 + spec.level * 12 + rng.variance(8), 10, 98),
        negotiation: clamp(35 + spec.level * 11 + rng.variance(10), 10, 98),
        commission: spec.commission,
        specialization: rng.pick(SPECIALIZATIONS),
        minStarPower: spec.minStarPower,
      });
    }
  }
  void universeId;
  return out;
}

export function agentFor(state: GameState): Agent | undefined {
  return state.player.agentId ? state.agents.find((a) => a.id === state.player.agentId) : undefined;
}

export function agentById(state: GameState, id: Id): Agent | undefined {
  return state.agents.find((a) => a.id === id);
}

/** Why an agent won't take the player right now, or null if they would. */
export function hireBlockedReason(player: Person, agent: Agent, approached: boolean): string | null {
  if (player.agentId === agent.id) return 'Already your agent.';
  if (approached) return null;
  if (player.attributes.starPower < agent.minStarPower) {
    return `${agent.agency} doesn't take clients below ${agent.minStarPower} star power.`;
  }
  return null;
}

export function hireAgent(state: GameState, agentId: Id): Agent {
  const agent = agentById(state, agentId);
  if (!agent) throw new Error('No such agent.');
  const approached = state.agentApproaches.includes(agentId);
  const reason = hireBlockedReason(state.player, agent, approached);
  if (reason) throw new Error(reason);
  state.player.agentId = agentId;
  state.agentApproaches = state.agentApproaches.filter((id) => id !== agentId);
  return agent;
}

export function fireAgent(state: GameState): void {
  state.player.agentId = undefined;
}

export interface AgentEffects {
  /** Extra budget tiers of listings the player hears about. */
  visibilityBoost: number;
  /** Added to callback probability. */
  callbackBonus: number;
  /** Added to negotiation leverage (0–100 scale). */
  leverageBonus: number;
  /** 0–1: how accurately the agent reads a studio's patience. */
  readAccuracy: number;
  /** Weekly chance multiplier for direct offers. */
  directOfferMultiplier: number;
  commission: number;
}

export function agentEffects(agent: Agent | undefined): AgentEffects {
  if (!agent) return { visibilityBoost: 0, callbackBonus: 0, leverageBonus: 0, readAccuracy: 0.3, directOfferMultiplier: 0.6, commission: 0 };
  return {
    visibilityBoost: agent.level >= 3 ? 1 : 0,
    callbackBonus: (agent.connections / 100) * 0.12,
    leverageBonus: (agent.negotiation / 100) * 25,
    readAccuracy: clamp(0.45 + agent.level * 0.1, 0, 0.95),
    directOfferMultiplier: 0.8 + agent.level * 0.2,
    commission: agent.commission,
  };
}

/** The agent's cut of a payment. */
export function commissionOn(agent: Agent | undefined, amount: number): number {
  return agent ? Math.round(amount * agent.commission) : 0;
}

/**
 * Weekly: agents notice heat. When the player's momentum is high and a better agency would take
 * them, that agency reaches out (once). Approaches lapse when the heat fades.
 */
export function tickAgentApproaches(state: GameState, bus: EventBus): void {
  const player = state.player;
  const current = agentFor(state);
  if (player.momentum < 10) {
    state.agentApproaches = [];
    return;
  }
  if (player.momentum < 20) return;
  const rng = rngFor(state.worldSeed, player.id, state.week, 'agent-approach');
  if (!rng.chance(0.12)) return;
  const candidates = state.agents.filter((a) =>
    a.id !== player.agentId &&
    !state.agentApproaches.includes(a.id) &&
    a.level > (current?.level ?? 0) &&
    player.attributes.starPower >= a.minStarPower - 10, // heat opens doors a little early
  );
  if (candidates.length === 0) return;
  const agent = rng.pick(candidates);
  state.agentApproaches.push(agent.id);
  bus.emit('agent', `${fullName(agent)} of ${agent.agency} wants to represent you`, `${LEVEL_LABEL[agent.level]} agency · ${Math.round(agent.commission * 100)}% commission · ${agent.specialization === 'general' ? 'all genres' : `${agent.specialization} specialist`}. Answer from the Agent panel.`);
}
