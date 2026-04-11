export const TILE_SIZE = 32;
export const MAP_WIDTH_TILES = 32;
export const MAP_HEIGHT_TILES = 32;
export const RIGHT_PANEL_WIDTH = 300;
export const GAME_WIDTH = window.innerWidth;
export const GAME_HEIGHT = window.innerHeight;

// How often each agent asks Claude for a new decision (ms)
export const AGENT_DECISION_INTERVAL_MS = 8000;

// Time per tile when walking (ms)
export const TILE_MOVE_DURATION_MS = 350;

// How long thought bubbles stay visible (ms)
export const THOUGHT_BUBBLE_DURATION_MS = 4000;

// Stagger between initial agent decisions (ms)
export const AGENT_DECISION_STAGGER_MS = 2000;

// Proximity in tiles to be considered "nearby"
export const NEARBY_AGENT_TILE_RADIUS = 5;

// Set to false to silence agent decision logs in the GM panel
export const TRACE_AGENT_DECISIONS = true;

// ─── Player ───────────────────────────────────────────────────────────────────
export const PLAYER_MOVE_DURATION_MS = 120;   // ms per tile (agents are 350ms)
export const PLAYER_CAMERA_ZOOM = 1.5;
export const PLAYER_INSPECT_RADIUS = 3;       // Manhattan distance in tiles

// ─── Game economy ─────────────────────────────────────────────────────────────
export const PLAYER_STARTING_BUDGET = 500;
export const ARREST_CORRECT_REWARD = 200;
export const ARREST_FALSE_PENALTY = 150;
