import Phaser from 'phaser';
import type { TilePosition } from '@shared/types';
import CityMap from '../map/CityMap';
import AgentSprite from './AgentSprite';
import { TILE_SIZE, TILE_MOVE_DURATION_MS } from '../config';

export default class MovementController {
  private scene: Phaser.Scene;
  private map: CityMap;
  private path: TilePosition[] = [];
  private moving = false;
  private onArrival: (() => void) | null = null;

  constructor(scene: Phaser.Scene, map: CityMap) {
    this.scene = scene;
    this.map = map;
  }

  walkTo(
    sprite: AgentSprite,
    from: TilePosition,
    to: TilePosition,
    onArrival: () => void
  ): void {
    this.path = this.map.findPath(from, to);
    this.onArrival = onArrival;

    if (this.path.length === 0) {
      onArrival();
      return;
    }

    this.moving = true;
    this.stepToNextTile(sprite);
  }

  private stepToNextTile(sprite: AgentSprite): void {
    if (this.path.length === 0) {
      this.moving = false;
      this.onArrival?.();
      return;
    }

    const next = this.path.shift()!;
    const worldPos = this.map.tileToWorld(next);

    this.scene.tweens.add({
      targets: sprite,
      x: worldPos.x,
      y: worldPos.y,
      duration: TILE_MOVE_DURATION_MS,
      ease: 'Linear',
      onUpdate: () => {
        sprite.setPosition(sprite.x, sprite.y);
      },
      onComplete: () => {
        sprite.setPosition(worldPos.x, worldPos.y);
        this.stepToNextTile(sprite);
      },
    });
  }

  isMoving(): boolean {
    return this.moving;
  }

  stop(): void {
    this.path = [];
    this.moving = false;
  }
}
