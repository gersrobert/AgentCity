import type { WorldState, AgentState } from '@shared/types';
import { PLANETS } from '../map/mapData';

const initialAgents: AgentState[] = [
  {
    id: 'agent_0',
    name: 'Mira',
    personality:
      'A cheerful cosmic planner who believes every planet should have more teal. She whispers to asteroids and swears they whisper back.',
    mood: 'happy',
    currentGoal: 'Studying the currents of Aquaria',
    currentThought: 'The whole universe needs more teal!',
    currentPlanetId: 'aquaria',
    position: { tileX: 6, tileY: 7 },
    targetLocationId: 'aquaria',
    lastDecisionAt: 0,
    pendingDecision: false,
  },
  {
    id: 'agent_1',
    name: 'Otto',
    personality:
      'A retired interstellar detective convinced the Ember volcanoes are hiding something. His notebook is full of suspicious lava formations.',
    mood: 'anxious',
    currentGoal: 'Investigating Ember for clues',
    currentThought: 'That eruption pattern looked deliberate.',
    currentPlanetId: 'ember',
    position: { tileX: 15, tileY: 18 },
    targetLocationId: 'ember',
    lastDecisionAt: 0,
    pendingDecision: false,
  },
  {
    id: 'agent_2',
    name: 'Zola',
    personality:
      'A philosopher-botanist who catalogues the emotional states of star systems. Currently in a "spiky nebulae" phase.',
    mood: 'curious',
    currentGoal: 'Meditating on Verdant',
    currentThought: 'This jungle hums in a minor key.',
    currentPlanetId: 'verdant',
    position: { tileX: 23, tileY: 6 },
    targetLocationId: 'verdant',
    lastDecisionAt: 0,
    pendingDecision: false,
  },
  {
    id: 'agent_3',
    name: 'Rex',
    personality:
      'An enthusiastic cosmic food critic who rates everything out of ten — planets, nebulae, and gravitational anomalies included.',
    mood: 'excited',
    currentGoal: 'Rating the mineral deposits on Dune',
    currentThought: 'Solid 8/10 gravitational pull.',
    currentPlanetId: 'dune',
    position: { tileX: 26, tileY: 22 },
    targetLocationId: 'dune',
    lastDecisionAt: 0,
    pendingDecision: false,
  },
];

export const worldState: WorldState = {
  locations: PLANETS.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    tile: { tileX: Math.round(p.xRatio * 30), tileY: Math.round(p.yRatio * 30) },
  })),
  weather: 'cosmic calm',
  timeOfDay: 'eternal night',
  activeEvents: [],
  agents: initialAgents,
};

export function getAgentById(id: string): AgentState | undefined {
  return worldState.agents.find((a) => a.id === id);
}
