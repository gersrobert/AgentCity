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

// Space scene
export const STAR_COUNT = 180;
export const TWINKLE_STAR_COUNT = 30;
export const NEBULA_OPACITY = 0.07;

// Set to false to silence agent decision logs in the GM panel
export const TRACE_AGENT_DECISIONS = true;

// ─── Player ───────────────────────────────────────────────────────────────────
// Player can travel to a neighbour planet with LEFT/RIGHT arrow keys
// Press E when on same planet as an agent to inspect them
export const PLAYER_INSPECT_RADIUS_SAME_PLANET = true;

// ─── Blackhole ────────────────────────────────────────────────────────────────
// Each illegal item delivery grows the blackhole by this fraction of max size.
// 10 deliveries to fill = 0.1 per delivery.
export const BLACKHOLE_GROWTH_PER_DELIVERY = 0.1;

// ─── Progressive unlock ───────────────────────────────────────────────────────
export const STARTING_PLANET_COUNT = 2;   // planets active at game start
export const PLANET_UNLOCK_INTERVAL_MS = 60_000;  // new planet every 60 s
export const AGENT_UNLOCK_INTERVAL_MS  = 30_000;  // new agent every 30 s
