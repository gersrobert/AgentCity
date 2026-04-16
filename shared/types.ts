// ─── Map / World ─────────────────────────────────────────────────────────────

export interface TilePosition {
  tileX: number;
  tileY: number;
}

export interface NamedLocation {
  id: string;
  label: string;
  tile: TilePosition;
  description: string;
}

export interface WorldState {
  locations: NamedLocation[];
  weather: string;
  timeOfDay: string;
  activeEvents: string[];
  agents: AgentState[];
  blackholeSize: number;   // 0–1, fraction of max size
}

// ─── Trading ─────────────────────────────────────────────────────────────────

export interface InventoryItem {
  name: string;
  quantity: number;
  isIllegal: boolean;
  buyPrice: number;
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export type Mood =
  | 'happy'
  | 'anxious'
  | 'curious'
  | 'bored'
  | 'excited'
  | 'sad'
  | 'angry'
  | 'content';

export interface AgentState {
  id: string;
  name: string;
  personality: string;
  mood: Mood;
  mission: string;               // permanent cover-story mission assigned at spawn, never changes
  currentThought: string;
  currentPlanetId: string;
  position: TilePosition;         // approximate tile coords for AI context
  targetLocationId: string | null;
  lastDecisionAt: number;
  pendingDecision: boolean;
  cash: number;
  inventory: InventoryItem[];     // legal items: unlimited; illegal items: max 1
}

// ─── AI Loop ─────────────────────────────────────────────────────────────────

export interface AgentThinkRequest {
  agent: AgentState;
  worldState: Omit<WorldState, 'agents'>;
  nearbyAgents: Pick<AgentState, 'id' | 'name' | 'mood' | 'mission'>[];
}

export interface AgentDecision {
  targetLocationId: string;
  newMood: Mood;
  thought: string;
  purchase: { itemName: string; quantity: number } | null;
}

// ─── Agent Spawn ─────────────────────────────────────────────────────────────

export interface AgentSpawnRequest {
  /** IDs of agents already in the world — so the LLM creates someone distinct. */
  existingAgentNames: string[];
  /** Planet the new agent will start on. */
  startingPlanetId: string;
  /** Current world context so the personality fits the setting. */
  worldContext: { weather: string; activeEvents: string[] };
}

export interface NewAgentProfile {
  name: string;
  personality: string;
  mood: Mood;
  mission: string;               // permanent cover-story mission, tied to starting planet
  currentThought: string;
}

// ─── Game Master ─────────────────────────────────────────────────────────────

export interface GMChatRequest {
  playerMessage: string;
  worldState: WorldState;
}

export interface WorldEvent {
  narrative: string;
  stateChanges: Partial<{
    weather: string;
    timeOfDay: string;
    activeEvents: string[];
    agentMoodOverrides: Record<string, Mood>;
  }>;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
