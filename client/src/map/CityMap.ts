import Phaser from 'phaser';
import {
  COLLISION_LAYER_DATA,
  NAMED_LOCATIONS,
  LocationMarker,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from './mapData';
import {
  TILE_SIZE,
  MAP_WIDTH_TILES,
  MAP_HEIGHT_TILES,
} from '../config';
import type { TilePosition, NamedLocation } from '@shared/types';

export default class CityMap {
  private walkableGrid: boolean[][];
  readonly locations: NamedLocation[];

  constructor() {
    this.walkableGrid = this.buildWalkableGrid();
    this.locations = NAMED_LOCATIONS.map((l) => ({
      id: l.id,
      label: l.label,
      tile: { tileX: l.tileX, tileY: l.tileY },
      description: l.description,
    }));
  }

  private buildWalkableGrid(): boolean[][] {
    const grid: boolean[][] = [];
    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
      grid[y] = [];
      for (let x = 0; x < MAP_WIDTH_TILES; x++) {
        grid[y][x] = COLLISION_LAYER_DATA[y * MAP_WIDTH_TILES + x] === 0;
      }
    }
    return grid;
  }

  isWalkable(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= MAP_WIDTH_TILES || tileY < 0 || tileY >= MAP_HEIGHT_TILES) {
      return false;
    }
    return this.walkableGrid[tileY][tileX];
  }

  tileToWorld(pos: TilePosition): { x: number; y: number } {
    return {
      x: pos.tileX * TILE_SIZE + TILE_SIZE / 2,
      y: pos.tileY * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  worldToTile(worldX: number, worldY: number): TilePosition {
    return {
      tileX: Math.floor(worldX / TILE_SIZE),
      tileY: Math.floor(worldY / TILE_SIZE),
    };
  }

  getLocation(id: string): NamedLocation | undefined {
    return this.locations.find((l) => l.id === id);
  }

  getRandomWalkableTile(): TilePosition {
    let attempts = 0;
    while (attempts < 1000) {
      const tileX = Math.floor(Math.random() * MAP_WIDTH_TILES);
      const tileY = Math.floor(Math.random() * MAP_HEIGHT_TILES);
      if (this.isWalkable(tileX, tileY)) {
        return { tileX, tileY };
      }
      attempts++;
    }
    // Fallback: center road intersection
    return { tileX: 16, tileY: 16 };
  }

  // BFS pathfinding
  findPath(from: TilePosition, to: TilePosition): TilePosition[] {
    if (!this.isWalkable(to.tileX, to.tileY)) {
      // Try to find a nearby walkable tile
      const nearby = this.findNearbyWalkable(to);
      if (!nearby) return [];
      to = nearby;
    }

    const queue: TilePosition[] = [from];
    const visited = new Set<string>();
    const parent = new Map<string, TilePosition | null>();

    const key = (p: TilePosition) => `${p.tileX},${p.tileY}`;
    visited.add(key(from));
    parent.set(key(from), null);

    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.tileX === to.tileX && current.tileY === to.tileY) {
        // Reconstruct path
        const path: TilePosition[] = [];
        let node: TilePosition | null = current;
        while (node !== null) {
          path.unshift(node);
          node = parent.get(key(node)) ?? null;
        }
        return path.slice(1); // exclude start position
      }

      for (const { dx, dy } of dirs) {
        const next: TilePosition = {
          tileX: current.tileX + dx,
          tileY: current.tileY + dy,
        };
        const nk = key(next);
        if (!visited.has(nk) && this.isWalkable(next.tileX, next.tileY)) {
          visited.add(nk);
          parent.set(nk, current);
          queue.push(next);
        }
      }
    }

    return []; // no path found
  }

  private findNearbyWalkable(pos: TilePosition): TilePosition | null {
    for (let r = 1; r <= 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const candidate = { tileX: pos.tileX + dx, tileY: pos.tileY + dy };
          if (this.isWalkable(candidate.tileX, candidate.tileY)) {
            return candidate;
          }
        }
      }
    }
    return null;
  }

  // Draw placeholder tiles onto a Phaser scene using Graphics
  drawPlaceholder(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    g.setDepth(0);

    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
      for (let x = 0; x < MAP_WIDTH_TILES; x++) {
        const wx = x * TILE_SIZE;
        const wy = y * TILE_SIZE;
        const blocked = !this.isWalkable(x, y);

        if (blocked) {
          // Building/wall tiles — darker
          g.fillStyle(0x5c4a3a, 1);
        } else {
          // Check if it's a road tile
          const isRoad =
            x === 8 || x === 16 || x === 24 || y === 8 || y === 16 || y === 24;
          if (isRoad) {
            g.fillStyle(0x888888, 1);
          } else {
            g.fillStyle(0x4a7c3f, 1);
          }
        }

        g.fillRect(wx, wy, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    }

    // Draw location labels
    for (const loc of NAMED_LOCATIONS) {
      const wx = loc.tileX * TILE_SIZE;
      const wy = loc.tileY * TILE_SIZE;

      // Location highlight
      g.fillStyle(0xffdd44, 0.4);
      g.fillRect(wx - TILE_SIZE, wy - TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 2);
    }
  }
}
