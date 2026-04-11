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
  playerBudget: number;
}

// ─── Trading ─────────────────────────────────────────────────────────────────

export type TradeType = 'legal' | 'illegal';

export interface TradeRecord {
  locationId: string;
  goods: string;
  profit: number;
  timestamp: number;
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
  currentGoal: string;
  currentThought: string;
  position: TilePosition;
  targetLocationId: string | null;
  lastDecisionAt: number;
  pendingDecision: boolean;
  cash: number;
  tradeType: TradeType;
  tradeHistory: TradeRecord[];
  suspicionLevel: number;
}

// ─── AI Loop ─────────────────────────────────────────────────────────────────

export interface AgentThinkRequest {
  agent: AgentState;
  worldState: Omit<WorldState, 'agents'>;
  nearbyAgents: Pick<AgentState, 'id' | 'name' | 'mood' | 'currentGoal'>[];
}

export interface AgentDecision {
  targetLocationId: string;
  newMood: Mood;
  newGoal: string;
  thought: string;
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

export interface ApiKeyRequest {
  apiKey: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
