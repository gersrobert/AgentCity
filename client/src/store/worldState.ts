import type { WorldState, AgentState, TradeType } from "@shared/types";
import { NAMED_LOCATIONS } from "../map/mapData";
import { PLAYER_STARTING_BUDGET } from "../config";

function randomCash(): number {
  return Math.floor(Math.random() * 401) + 100;
}

function tradeType(index: number): TradeType {
  return index === 1 || index === 3 ? 'illegal' : 'legal';
}

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
    cash: randomCash(),
    tradeType: tradeType(0),
    tradeHistory: [],
    suspicionLevel: 0,
  },
  {
    id: "agent_1",
    name: "Otto",
    personality:
      "A retired detective with a nose for opportunity. He keeps a notebook — not of crimes, but of contacts. Speaks in half-sentences and never stays in one place too long.",
    mood: "anxious",
    currentGoal: "Checking on a quiet arrangement",
    currentThought: "Best not to linger.",
    position: { tileX: 8, tileY: 16 },
    targetLocationId: "cafe",
    lastDecisionAt: 0,
    pendingDecision: false,
    cash: randomCash(),
    tradeType: tradeType(1),
    tradeHistory: [],
    suspicionLevel: 0,
  },
  {
    id: "agent_2",
    name: "Zola",
    personality:
      'A philosopher-florist who arranges flowers to mirror the emotional state of the city. Currently going through a "spiky plants" phase.',
    mood: "curious",
    currentGoal: "Finding inspiration at the park",
    currentThought: "The tulips feel melancholy today.",
    position: { tileX: 24, tileY: 8 },
    targetLocationId: "park",
    lastDecisionAt: 0,
    pendingDecision: false,
    cash: randomCash(),
    tradeType: tradeType(2),
    tradeHistory: [],
    suspicionLevel: 0,
  },
  {
    id: "agent_3",
    name: "Rex",
    personality:
      "A food critic by reputation, an importer of specialty goods by trade. He rates restaurants to explain why he visits them so often. Very particular about where he sources his ingredients.",
    mood: "excited",
    currentGoal: "Sourcing something rare at the market",
    currentThought: "Certain vendors only appear at night.",
    position: { tileX: 8, tileY: 24 },
    targetLocationId: "market",
    lastDecisionAt: 0,
    pendingDecision: false,
    cash: randomCash(),
    tradeType: tradeType(3),
    tradeHistory: [],
    suspicionLevel: 0,
  },
  {
    id: "agent_4",
    name: "Sam",
    personality:
      "An enthusiastic street musician who barters instruments and busks for tips. Believes every plaza needs a soundtrack and every café needs a resident performer.",
    mood: "content",
    currentGoal: "Finding a good busking spot",
    currentThought: "The acoustics here are perfect.",
    position: { tileX: 16, tileY: 24 },
    targetLocationId: "plaza",
    lastDecisionAt: 0,
    pendingDecision: false,
    cash: randomCash(),
    tradeType: tradeType(4),
    tradeHistory: [],
    suspicionLevel: 0,
  },
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
  playerBudget: PLAYER_STARTING_BUDGET,
};

export function getAgentById(id: string): AgentState | undefined {
  return worldState.agents.find((a) => a.id === id);
}

export function applyBudgetChange(delta: number): void {
  worldState.playerBudget = Math.max(0, worldState.playerBudget + delta);
}

export function isGameOver(): boolean {
  return worldState.playerBudget <= 0;
}
