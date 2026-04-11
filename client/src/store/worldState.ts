import type { WorldState, AgentState, NamedLocation } from '@shared/types';
import { PLANETS, PlanetData } from '../map/mapData';
import { STARTING_PLANET_COUNT } from '../config';

export function randomCash(): number {
  return 100;
}

// All agent definitions — only the first is active at game start.
// The rest are spawned progressively by GameScene.
export const AGENT_POOL: Omit<AgentState, 'cash'>[] = [
  {
    id: 'agent_0',
    name: 'Mira',
    personality:
      'A cheerful cosmic planner who believes every planet should have more teal. She whispers to asteroids and swears they whisper back.',
    mood: 'happy',
    currentGoal: 'Exploring the system',
    currentThought: 'The whole universe needs more teal!',
    currentPlanetId: 'aquaria',
    position: { tileX: 6, tileY: 7 },
    targetLocationId: 'aquaria',
    lastDecisionAt: 0,
    pendingDecision: false,
    inventory: [],
  },
  {
    id: 'agent_1',
    name: 'Otto',
    personality:
      'A retired interstellar detective convinced the Ember volcanoes are hiding something. His notebook is full of suspicious lava formations.',
    mood: 'anxious',
    currentGoal: 'Sniffing out opportunity',
    currentThought: 'Something is definitely off here.',
    currentPlanetId: 'aquaria',
    position: { tileX: 6, tileY: 7 },
    targetLocationId: 'aquaria',
    lastDecisionAt: 0,
    pendingDecision: false,
    inventory: [],
  },
  {
    id: 'agent_2',
    name: 'Zola',
    personality:
      'A philosopher-botanist who catalogues the emotional states of star systems. Currently in a "spiky nebulae" phase.',
    mood: 'curious',
    currentGoal: 'Seeking cosmic truth',
    currentThought: 'This system hums in a minor key.',
    currentPlanetId: 'aquaria',
    position: { tileX: 6, tileY: 7 },
    targetLocationId: 'aquaria',
    lastDecisionAt: 0,
    pendingDecision: false,
    inventory: [],
  },
  {
    id: 'agent_3',
    name: 'Rex',
    personality:
      'An enthusiastic cosmic food critic who rates everything out of ten — planets, nebulae, and gravitational anomalies included.',
    mood: 'excited',
    currentGoal: 'Rating everything in sight',
    currentThought: 'Solid 8/10 gravitational pull.',
    currentPlanetId: 'aquaria',
    position: { tileX: 6, tileY: 7 },
    targetLocationId: 'aquaria',
    lastDecisionAt: 0,
    pendingDecision: false,
    inventory: [],
  },
];

function planetToLocation(p: PlanetData): NamedLocation {
  return {
    id: p.id,
    label: p.label,
    description: p.description,
    tile: { tileX: Math.round(p.xRatio * 30), tileY: Math.round(p.yRatio * 30) },
  };
}

export const worldState: WorldState = {
  // Start with only the first STARTING_PLANET_COUNT planets + blackhole
  locations: [
    ...PLANETS.slice(0, STARTING_PLANET_COUNT).map(planetToLocation),
    {
      id: 'blackhole',
      label: 'The Black Hole',
      description: 'A hungry void at the centre of everything. Illegal deliveries feed its growth.',
      tile: { tileX: 15, tileY: 15 },
    },
  ],
  weather: 'cosmic calm',
  timeOfDay: 'eternal night',
  activeEvents: [],
  // Start with only the first agent
  agents: [{ ...AGENT_POOL[0], cash: randomCash() }],
  blackholeSize: 0,
};

/** Add the next planet to the world's known locations. */
export function unlockPlanet(planet: PlanetData): void {
  worldState.locations.push(planetToLocation(planet));
}

export function getAgentById(id: string): AgentState | undefined {
  return worldState.agents.find((a) => a.id === id);
}

export function growBlackhole(amount: number): void {
  worldState.blackholeSize = Math.min(1, worldState.blackholeSize + amount);
}

export function isGameOver(): boolean {
  return worldState.blackholeSize >= 1;
}
