// Inline city map definition.
// Tile IDs:
//   0 = empty (walkable grass)
//   1 = path (walkable pavement)
//   2 = building wall (unwalkable)
//   3 = park decoration (walkable)

import { TILE_SIZE, MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from '../config';

// Named locations: destinations agents can walk to
export interface LocationMarker {
  id: string;
  label: string;
  tileX: number;
  tileY: number;
  description: string;
}

export const NAMED_LOCATIONS: LocationMarker[] = [
  {
    id: 'town_hall',
    label: 'Town Hall',
    tileX: 14,
    tileY: 6,
    description: 'The grand civic center where bureaucracy and gossip thrive equally.',
  },
  {
    id: 'cafe',
    label: 'Cozy Café',
    tileX: 5,
    tileY: 14,
    description: 'A warm little café serving questionable coffee and excellent pastries.',
  },
  {
    id: 'park',
    label: 'City Park',
    tileX: 22,
    tileY: 10,
    description: 'A peaceful green space with benches, pigeons, and existential thoughts.',
  },
  {
    id: 'market',
    label: 'Night Market',
    tileX: 8,
    tileY: 24,
    description: 'A bustling market with strange goods and stranger vendors.',
  },
  {
    id: 'plaza',
    label: 'Central Plaza',
    tileX: 16,
    tileY: 17,
    description: 'The heart of the city — everyone passes through here eventually.',
  },
];

// Ground layer: 0=grass, 1=path
// Simple city grid layout
function buildGroundLayer(): number[] {
  const data: number[] = new Array(MAP_WIDTH_TILES * MAP_HEIGHT_TILES).fill(0);

  const set = (x: number, y: number, v: number) => {
    if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
      data[y * MAP_WIDTH_TILES + x] = v;
    }
  };

  // Horizontal roads
  for (let x = 0; x < MAP_WIDTH_TILES; x++) {
    set(x, 8, 1);
    set(x, 16, 1);
    set(x, 24, 1);
  }

  // Vertical roads
  for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
    set(8, y, 1);
    set(16, y, 1);
    set(24, y, 1);
  }

  // Intersections already covered by above loops

  return data;
}

// Collision layer: 1=blocked, 0=walkable
function buildCollisionLayer(): number[] {
  const data: number[] = new Array(MAP_WIDTH_TILES * MAP_HEIGHT_TILES).fill(0);

  const block = (x: number, y: number) => {
    if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
      data[y * MAP_WIDTH_TILES + x] = 1;
    }
  };

  // Block building areas (interior tiles that are not roads)
  // Buildings are in the blocks between roads
  // Block 1: x 0-7, y 0-7
  for (let bx = 1; bx <= 6; bx++) {
    for (let by = 1; by <= 6; by++) {
      block(bx, by);
    }
  }

  // Block 2: x 9-15, y 0-7
  for (let bx = 9; bx <= 14; bx++) {
    for (let by = 1; by <= 6; by++) {
      block(bx, by);
    }
  }

  // Block 3: x 17-23, y 0-7
  for (let bx = 17; bx <= 23; bx++) {
    for (let by = 1; by <= 6; by++) {
      block(bx, by);
    }
  }

  // Block 4: x 0-7, y 9-15
  for (let bx = 1; bx <= 6; bx++) {
    for (let by = 9; by <= 14; by++) {
      block(bx, by);
    }
  }

  // Block 5: x 9-15, y 9-15 (town hall area — leave center open)
  for (let bx = 9; bx <= 14; bx++) {
    for (let by = 9; by <= 14; by++) {
      // Leave a 2-tile border walkable for the building entrance
      if (!(bx >= 11 && bx <= 13 && by >= 12 && by <= 14)) {
        block(bx, by);
      }
    }
  }

  // Block 6: park area — all walkable (no blocks)

  // Block 7: x 0-7, y 17-23
  for (let bx = 1; bx <= 6; bx++) {
    for (let by = 17; by <= 22; by++) {
      block(bx, by);
    }
  }

  // Block 8: market area x 9-15, y 17-23 — leave open for market stalls
  for (let bx = 9; bx <= 14; bx++) {
    for (let by = 17; by <= 22; by++) {
      if (by < 18 || by > 21 || bx < 10 || bx > 13) {
        block(bx, by);
      }
    }
  }

  // Border walls
  for (let x = 0; x < MAP_WIDTH_TILES; x++) {
    block(x, 0);
    block(x, MAP_HEIGHT_TILES - 1);
  }
  for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
    block(0, y);
    block(MAP_WIDTH_TILES - 1, y);
  }

  return data;
}

export const GROUND_LAYER_DATA = buildGroundLayer();
export const COLLISION_LAYER_DATA = buildCollisionLayer();

export const TILE_SIZE_PX = TILE_SIZE;
export const WORLD_WIDTH = MAP_WIDTH_TILES * TILE_SIZE;
export const WORLD_HEIGHT = MAP_HEIGHT_TILES * TILE_SIZE;
