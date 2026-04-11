import Phaser from 'phaser';
import CityMap from '../map/CityMap';
import AgentManager from '../agents/AgentManager';

// The player is a freely-flying glowing orb controlled with WASD / arrow keys.
// E key inspects a nearby agent (within INSPECT_RANGE px).

const PLAYER_COLOR = 0xffffff;
const MOVE_SPEED   = 220;          // px/s
const INSPECT_RANGE = 80;          // px from player centre to agent centre

export default class PlayerController {
  // Current position (world px)
  x = 0;
  y = 0;

  private scene: Phaser.Scene;
  private map: CityMap;
  private agentManager: AgentManager;

  // Visuals
  private orbGfx: Phaser.GameObjects.Graphics;
  private labelText: Phaser.GameObjects.Text;
  private promptText: Phaser.GameObjects.Text;
  private trailGfx: Phaser.GameObjects.Graphics;
  private trailPoints: { x: number; y: number }[] = [];

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up:    Phaser.Input.Keyboard.Key;
    down:  Phaser.Input.Keyboard.Key;
    left:  Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private inspectKey!: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene, map: CityMap, agentManager: AgentManager, startPlanetId: string) {
    this.scene = scene;
    this.map = map;
    this.agentManager = agentManager;

    // Start near the first planet
    const pos = map.getPlanetPixelPos(startPlanetId);
    const r   = map.getPlanetRadius(startPlanetId);
    this.x = pos.x - r - 40;
    this.y = pos.y;

    // Visuals
    this.trailGfx  = scene.add.graphics().setDepth(9);
    this.orbGfx    = scene.add.graphics().setDepth(12);
    this.labelText = scene.add.text(this.x, this.y - 22, 'YOU', {
      fontSize: '10px',
      color: '#88ccff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2,
    }).setOrigin(0.5, 1).setDepth(13);

    this.promptText = scene.add.text(this.x, this.y - 36, '[E] Inspect', {
      fontSize: '8px',
      color: '#ffdd44',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2,
    }).setOrigin(0.5, 1).setDepth(13).setVisible(false);

    this.drawOrb();
    this.syncVisuals();

    // Input
    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      up:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.inspectKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.inspectKey.on('down', () => this.tryInspect());
  }

  update(delta: number): void {
    const dt = delta / 1000; // seconds

    // Directional input
    const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.down.isDown;

    let dx = 0;
    let dy = 0;
    if (left)  dx -= 1;
    if (right) dx += 1;
    if (up)    dy -= 1;
    if (down)  dy += 1;

    // Normalise diagonal movement
    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    const moving = dx !== 0 || dy !== 0;

    if (moving) {
      this.x += dx * MOVE_SPEED * dt;
      this.y += dy * MOVE_SPEED * dt;

      // Trail
      this.trailPoints.push({ x: this.x, y: this.y });
      if (this.trailPoints.length > 40) this.trailPoints.shift();

      this.trailGfx.clear();
      for (let i = 1; i < this.trailPoints.length; i++) {
        const t = i / this.trailPoints.length;
        this.trailGfx.fillStyle(PLAYER_COLOR, t * 0.4);
        this.trailGfx.fillCircle(this.trailPoints[i].x, this.trailPoints[i].y, 1 + t * 2);
      }
    } else {
      // Fade trail when stopped
      if (this.trailPoints.length > 0) {
        this.trailPoints.shift();
        this.trailGfx.clear();
        for (let i = 1; i < this.trailPoints.length; i++) {
          const t = i / this.trailPoints.length;
          this.trailGfx.fillStyle(PLAYER_COLOR, t * 0.4);
          this.trailGfx.fillCircle(this.trailPoints[i].x, this.trailPoints[i].y, 1 + t * 2);
        }
      }
    }

    this.syncVisuals();

    // Inspect prompt
    this.promptText.setVisible(this.hasNearbyAgent());
  }

  private tryInspect(): void {
    const agents = this.agentManager.getAgents();
    for (const managed of agents) {
      const ax = managed.sprite.x;
      const ay = managed.sprite.y;
      const dist = Math.hypot(ax - this.x, ay - this.y);
      if (dist <= INSPECT_RANGE && !managed.movement.isMoving()) {
        this.agentManager.pauseAgent(managed.state.id);
        this.scene.events.emit('AGENT_SELECTED', managed.state);
        return;
      }
    }
  }

  private hasNearbyAgent(): boolean {
    const agents = this.agentManager.getAgents();
    return agents.some(m => {
      const dist = Math.hypot(m.sprite.x - this.x, m.sprite.y - this.y);
      return dist <= INSPECT_RANGE && !m.movement.isMoving();
    });
  }

  /** No longer used — kept as a no-op so callers don't break. */
  getCurrentPlanetId(): string {
    return '';
  }

  private drawOrb(): void {
    this.orbGfx.clear();
    // Outer halo (white-blue tint)
    this.orbGfx.fillStyle(0x88ccff, 0.1);
    this.orbGfx.fillCircle(0, 0, 20);
    // Mid glow
    this.orbGfx.fillStyle(0xaaddff, 0.3);
    this.orbGfx.fillCircle(0, 0, 12);
    // Core
    this.orbGfx.fillStyle(0xffffff, 0.95);
    this.orbGfx.fillCircle(0, 0, 6);
    // Blue inner spark
    this.orbGfx.fillStyle(0x88ccff, 1);
    this.orbGfx.fillCircle(0, 0, 3);
    // Bright center
    this.orbGfx.fillStyle(0xffffff, 1);
    this.orbGfx.fillCircle(0, 0, 1.5);
  }

  private syncVisuals(): void {
    this.orbGfx.setPosition(this.x, this.y);
    this.labelText.setPosition(this.x, this.y - 22);
    this.promptText.setPosition(this.x, this.y - 36);
  }

  destroy(): void {
    this.orbGfx.destroy();
    this.labelText.destroy();
    this.promptText.destroy();
    this.trailGfx.destroy();
  }
}
