import type { WorldState, AgentState } from "@shared/types";
import { NAMED_LOCATIONS } from "../map/mapData";
import { PLAYER_STARTING_BUDGET } from "../config";

function randomCash(): number {
  return Math.floor(Math.random() * 401) + 100;
}

const initialAgents: AgentState[] = [
  {
    id: "agent_0",
    name: "Mira",
    personality:
      "A cheerful city planner who secretly thinks every building should be painted teal. She talks to pigeons and swears they talk back.",
    mood: "happy",
    currentGoal: "Checking out the café",
    currentThought: "This city needs more teal!",
    position: { tileX: 16, tileY: 16 },
    targetLocationId: "cafe",
    lastDecisionAt: 0,
    pendingDecision: false,
    cash: randomCash(),
    inventory: null,
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
