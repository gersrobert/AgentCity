import { PLANETS, PlanetData } from './mapData';
import type { NamedLocation, TilePosition } from '@shared/types';
import { TILE_SIZE } from '../config';

export interface PlanetPixelPos {
  x: number;
  y: number;
}

export default class CityMap {
  private mapWidth: number;
  private mapHeight: number;
  private planetPositions = new Map<string, PlanetPixelPos>();
  readonly locations: NamedLocation[];

  constructor(mapWidth: number, mapHeight: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    // Compute pixel positions from ratios
    for (const p of PLANETS) {
      this.planetPositions.set(p.id, {
        x: Math.round(p.xRatio * mapWidth),
        y: Math.round(p.yRatio * mapHeight),
      });
    }
    // Blackhole sits at the centre
    this.planetPositions.set('blackhole', { x: mapWidth / 2, y: mapHeight / 2 });

    // Build NamedLocation list for compatibility with server types
    this.locations = PLANETS.map((p) => {
      const pos = this.planetPositions.get(p.id)!;
      return {
        id: p.id,
        label: p.label,
        description: p.description,
        tile: {
          tileX: Math.round(pos.x / TILE_SIZE),
          tileY: Math.round(pos.y / TILE_SIZE),
        } as TilePosition,
      };
    });
  }

  getLocation(id: string): NamedLocation | undefined {
    return this.locations.find((l) => l.id === id);
  }

  getPlanetPixelPos(id: string): PlanetPixelPos {
    return this.planetPositions.get(id) ?? { x: this.mapWidth / 2, y: this.mapHeight / 2 };
  }

  getPlanetRadius(id: string): number {
    if (id === 'blackhole') return 20; // agents orbit just outside the event horizon
    return PLANETS.find((p) => p.id === id)?.radius ?? 70;
  }

  getPlanetData(id: string): PlanetData | undefined {
    return PLANETS.find((p) => p.id === id);
  }

  getAllPlanets(): PlanetData[] {
    return PLANETS;
  }

  getRandomPlanetId(): string {
    return PLANETS[Math.floor(Math.random() * PLANETS.length)].id;
  }

  getMapDimensions(): { width: number; height: number } {
    return { width: this.mapWidth, height: this.mapHeight };
  }
}
