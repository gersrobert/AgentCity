import type { WorldState, AgentState } from "@shared/types";
import { NAMED_LOCATIONS } from "../map/mapData";

const initialAgents: AgentState[] = [
  {
    id: "agent_0",
    name: "Mira",
    personality:
      "A cheerful city planner who secretly thinks every building should be painted teal. She talks to pigeons and swears they talk back.",
    mood: "happy",
    currentGoal: "Inspecting the town hall fountain",
    currentThought: "This city needs more teal!",
    position: { tileX: 16, tileY: 8 },
    targetLocationId: "town_hall",
    lastDecisionAt: 0,
    pendingDecision: false,
  },
  //  {
  //    id: 'agent_1',
  //    name: 'Otto',
  //    personality:
  //      'A retired detective who is convinced the local café is a front for something. He keeps a notebook full of suspicious pastry purchases.',
  //    mood: 'anxious',
  //    currentGoal: 'Staking out the café',
  //    currentThought: 'That croissant looked suspicious.',
  //    position: { tileX: 8, tileY: 16 },
  //    targetLocationId: 'cafe',
  //    lastDecisionAt: 0,
  //    pendingDecision: false,
  //  },
  //  {
  //    id: 'agent_2',
  //    name: 'Zola',
  //    personality:
  //      'A philosopher-florist who arranges flowers to mirror the emotional state of the city. Currently going through a "spiky plants" phase.',
  //    mood: 'curious',
  //    currentGoal: 'Finding inspiration at the park',
  //    currentThought: 'The tulips feel melancholy today.',
  //    position: { tileX: 24, tileY: 8 },
  //    targetLocationId: 'park',
  //    lastDecisionAt: 0,
  //    pendingDecision: false,
  //  },
  //  {
  //    id: 'agent_3',
  //    name: 'Rex',
  //    personality:
  //      'An enthusiastic food critic who rates everything out of ten, including weather, conversations, and strangers\' shoes.',
  //    mood: 'excited',
  //    currentGoal: 'Rating the market street food',
  //    currentThought: 'Solid 7/10 cloud formation up there.',
  //    position: { tileX: 8, tileY: 24 },
  //    targetLocationId: 'market',
  //    lastDecisionAt: 0,
  //    pendingDecision: false,
  //  },
];

export const worldState: WorldState = {
  locations: NAMED_LOCATIONS.map((l) => ({
    id: l.id,
    label: l.label,
    tile: { tileX: l.tileX, tileY: l.tileY },
    description: l.description,
  })),
  weather: "sunny",
  timeOfDay: "morning",
  activeEvents: [],
  agents: initialAgents,
};

export function getAgentById(id: string): AgentState | undefined {
  return worldState.agents.find((a) => a.id === id);
}
