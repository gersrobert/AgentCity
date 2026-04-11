import type { WorldState, AgentState, NamedLocation } from '@shared/types';
import { PLANETS, PlanetData } from '../map/mapData';
import { STARTING_PLANET_COUNT } from '../config';

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
  agents: [],
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
