import Phaser from 'phaser';
import type { AgentState } from '@shared/types';
import CityMap from '../map/CityMap';
import AgentManager from '../agents/AgentManager';
import { TILE_SIZE, PLAYER_MOVE_DURATION_MS, PLAYER_INSPECT_RADIUS, PLAYER_CAMERA_ZOOM } from '../config';
import { worldState } from '../store/worldState';

export default class PlayerController {
  private scene: Phaser.Scene;
  private map: CityMap;
  private agentManager: AgentManager;

  private circle: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private inspectPrompt: Phaser.GameObjects.Text;

  tileX: number;
  tileY: number;
  x: number;
  y: number;

  private isMoving = false;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'inspect', Phaser.Input.Keyboard.Key>;

  constructor(scene: Phaser.Scene, map: CityMap, agentManager: AgentManager, startTile: { tileX: number; tileY: number }) {
    this.scene = scene;
    this.map = map;
    this.agentManager = agentManager;
    this.tileX = startTile.tileX;
    this.tileY = startTile.tileY;

    const wp = map.tileToWorld(startTile);
    this.x = wp.x;
    this.y = wp.y;

    // ── Visuals ──────────────────────────────────────────────────────────────
    this.circle = scene.add.graphics().setDepth(15);
    this.drawBody();

    this.label = scene.add.text(0, 0, 'YOU', {
      fontSize: '9px',
      color: '#88ccff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2,
    }).setOrigin(0.5, 1).setDepth(16);

    this.inspectPrompt = scene.add.text(0, 0, '[E] Inspect', {
      fontSize: '8px',
      color: '#ffdd44',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2,
    }).setOrigin(0.5, 1).setDepth(17).setVisible(false);

    this.setPosition(this.x, this.y);

    // ── Input ─────────────────────────────────────────────────────────────────
    const kb = scene.input.keyboard!;
    this.keys = {
      up:      kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right:   kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      inspect: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
    };

    this.keys.inspect.on('down', () => this.tryInspect());

    // ── Camera ────────────────────────────────────────────────────────────────
    scene.cameras.main.setZoom(PLAYER_CAMERA_ZOOM);
    scene.cameras.main.startFollow(this.circle, true, 0.1, 0.1);
  }

  update(): void {
    if (!this.isMoving) {
      let dx = 0, dy = 0;
      if      (this.keys.up.isDown)    dy = -1;
      else if (this.keys.down.isDown)  dy =  1;
      else if (this.keys.left.isDown)  dx = -1;
      else if (this.keys.right.isDown) dx =  1;
      if (dx || dy) this.move(dx, dy);
    }

    this.inspectPrompt.setVisible(this.nearestInspectable() !== null);
  }

  private move(dx: number, dy: number): void {
    const nx = this.tileX + dx;
    const ny = this.tileY + dy;
    if (!this.map.isWalkable(nx, ny)) return;

    this.isMoving = true;
    this.tileX = nx;
    this.tileY = ny;

    const target = this.map.tileToWorld({ tileX: nx, tileY: ny });
    this.scene.tweens.add({
      targets: this,
      x: target.x,
      y: target.y,
      duration: PLAYER_MOVE_DURATION_MS,
      ease: 'Linear',
      onUpdate: () => this.setPosition(this.x, this.y),
      onComplete: () => { this.isMoving = false; },
    });
  }

  private setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.circle.setPosition(x, y);
    this.label.setPosition(x, y - 24);
    this.inspectPrompt.setPosition(x, y - 38);
  }

  private nearestInspectable(): AgentState | null {
    let best: AgentState | null = null;
    let bestDist = Infinity;
    for (const agent of worldState.agents) {
      if (!this.agentManager.isAgentInterceptable(agent.id)) continue;
      const tile = this.agentManager.getAgentLiveTile(agent.id);
      if (!tile) continue;
      const dist =
        Math.abs(tile.tileX - this.tileX) +
        Math.abs(tile.tileY - this.tileY);
      if (dist <= PLAYER_INSPECT_RADIUS && dist < bestDist) {
        bestDist = dist;
        best = agent;
      }
    }
    return best;
  }

  private tryInspect(): void {
    const agent = this.nearestInspectable();
    if (agent) {
      this.agentManager.pauseAgent(agent.id);
      this.scene.events.emit('AGENT_SELECTED', agent);
    }
  }

  private drawBody(): void {
    this.circle.clear();
    // Blue detective fill
    this.circle.fillStyle(0x1133bb, 1);
    this.circle.fillCircle(0, 0, TILE_SIZE * 0.55);
    // Bright outline
    this.circle.lineStyle(2.5, 0x88ccff, 1);
    this.circle.strokeCircle(0, 0, TILE_SIZE * 0.55);
    // Eyes
    this.circle.fillStyle(0xffffff, 1);
    this.circle.fillCircle(-5, -3, 2.5);
    this.circle.fillCircle(5, -3, 2.5);
    // Determined flat mouth
    this.circle.lineStyle(2, 0xffffff, 1);
    this.circle.beginPath();
    this.circle.moveTo(-4, 4);
    this.circle.lineTo(4, 4);
    this.circle.strokePath();
  }
}
