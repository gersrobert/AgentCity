// Inline city map definition.
// Tile IDs:
//   0 = empty (walkable grass / courtyard)
//   1 = path (walkable pavement)
//   2 = building wall (unwalkable)

import { TILE_SIZE, MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from '../config';

// Named locations: destinations agents can walk to
export interface LocationMarker {
  id: string;
  label: string;
  tileX: number;
  tileY: number;
  description: string;
}

// Five locations — one in each corner, one in the centre.
// Each sits inside a building pocket reachable via a short driveway to the nearest road.
export const NAMED_LOCATIONS: LocationMarker[] = [
  {
    id: 'cafe',
    label: 'Cozy Café',
    tileX: 4,
    tileY: 4,
    description: 'A warm little café serving questionable coffee and excellent pastries.',
  },
  {
    id: 'park',
    label: 'City Park',
    tileX: 27,
    tileY: 4,
    description: 'A peaceful green space with benches, pigeons, and existential thoughts.',
  },
  {
    id: 'town_hall',
    label: 'Town Hall',
    tileX: 12,
    tileY: 12,
    description: 'The grand civic centre where bureaucracy and gossip thrive equally.',
  },
  {
    id: 'market',
    label: 'Night Market',
    tileX: 4,
    tileY: 27,
    description: 'A bustling market with strange goods and stranger vendors.',
  },
  {
    id: 'plaza',
    label: 'Central Plaza',
    tileX: 27,
    tileY: 27,
    description: 'The heart of the city — everyone passes through here eventually.',
  },
];

// Ground layer: 0=grass/courtyard, 1=road
function buildGroundLayer(): number[] {
  const W = MAP_WIDTH_TILES;
  const H = MAP_HEIGHT_TILES;
  const data: number[] = new Array(W * H).fill(0);

  const setRoad = (x: number, y: number) => {
    if (x >= 0 && x < W && y >= 0 && y < H) data[y * W + x] = 1;
  };

  // Roads — same grid as before
  for (let x = 0; x < W; x++) { setRoad(x, 8); setRoad(x, 16); setRoad(x, 24); }
  for (let y = 0; y < H; y++) { setRoad(8, y); setRoad(16, y); setRoad(24, y); }

  return data;
}

// Collision layer: 1=blocked, 0=walkable
// Strategy: start fully blocked, then carve roads and shop pockets.
function buildCollisionLayer(): number[] {
  const W = MAP_WIDTH_TILES;
  const H = MAP_HEIGHT_TILES;
  const data: number[] = new Array(W * H).fill(1); // everything blocked

  const carve = (x: number, y: number) => {
    if (x >= 0 && x < W && y >= 0 && y < H) data[y * W + x] = 0;
  };

  // ── Roads ──────────────────────────────────────────────────────────────────
  for (let i = 0; i < W; i++) { carve(i, 8); carve(i, 16); carve(i, 24); }
  for (let i = 0; i < H; i++) { carve(8, i); carve(16, i); carve(24, i); }

  // ── Café (4, 4) — top-left corner ─────────────────────────────────────────
  // 3×3 courtyard
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) carve(4 + dx, 4 + dy);
  // Driveway south to y=8 road
  carve(4, 6); carve(4, 7);

  // ── City Park (27, 4) — top-right corner ──────────────────────────────────
  // 3×3 courtyard
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) carve(27 + dx, 4 + dy);
  // Driveway west to x=24 road
  carve(25, 4); carve(26, 4); // (26,4) already in courtyard, (25,4) is the connector

  // ── Town Hall (12, 12) — centre block ─────────────────────────────────────
  // 3×3 courtyard
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) carve(12 + dx, 12 + dy);
  // Driveway south to y=16 road
  carve(12, 14); carve(12, 15);

  // ── Night Market (4, 27) — bottom-left corner ─────────────────────────────
  // 3×3 courtyard
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) carve(4 + dx, 27 + dy);
  // Driveway north to y=24 road
  carve(4, 25); carve(4, 26); // (4,26) already in courtyard, (4,25) is the connector

  // ── Central Plaza (27, 27) — bottom-right corner ──────────────────────────
  // 3×3 courtyard
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) carve(27 + dx, 27 + dy);
  // Driveway west to x=24 road
  carve(25, 27); carve(26, 27); // (26,27) already in courtyard, (25,27) is the connector

  return data;
}

export const GROUND_LAYER_DATA = buildGroundLayer();
export const COLLISION_LAYER_DATA = buildCollisionLayer();

export const TILE_SIZE_PX = TILE_SIZE;
export const WORLD_WIDTH = MAP_WIDTH_TILES * TILE_SIZE;
export const WORLD_HEIGHT = MAP_HEIGHT_TILES * TILE_SIZE;
