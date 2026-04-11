import Phaser from 'phaser';
import CityMap from '../map/CityMap';
import AgentManager from '../agents/AgentManager';

// ── Tuning ────────────────────────────────────────────────────────────────────
const TURN_SPEED    = 180;   // degrees per second while A/D held
const THRUST        = 320;   // px/s² acceleration
const MAX_SPEED     = 420;   // px/s terminal velocity
const DRAG          = 0.97;  // velocity multiplier per frame (friction)
const ROCKET_RADIUS = 8;     // collision radius used for planet push-out
const INSPECT_RANGE = 90;    // px from rocket centre to agent centre

// ── Rocket geometry (drawn at origin, pointing UP) ────────────────────────────
const BODY_W = 10;
const BODY_H = 22;
const NOSE_H = 10;
const WING_W = 8;
const WING_H = 7;

export default class RocketController {
  // World position (used externally for inspect checks etc.)
  x = 0;
  y = 0;

  private scene: Phaser.Scene;
  private map: CityMap;
  private agentManager: AgentManager;

  private container: Phaser.GameObjects.Container;
  private thrusterGfx: Phaser.GameObjects.Graphics;
  private labelText: Phaser.GameObjects.Text;
  private promptText: Phaser.GameObjects.Text;

  private keys: {
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  };
  private inspectKey: Phaser.Input.Keyboard.Key;

  // Physics state
  private vx = 0;
  private vy = 0;

  private mapWidth: number;
  private mapHeight: number;

  constructor(
    scene: Phaser.Scene,
    map: CityMap,
    agentManager: AgentManager,
    x: number,
    y: number,
  ) {
    this.scene = scene;
    this.map = map;
    this.agentManager = agentManager;
    this.x = x;
    this.y = y;

    const { width, height } = map.getMapDimensions();
    this.mapWidth = width;
    this.mapHeight = height;

    // ── Body graphics ─────────────────────────────────────────────────────────
    const bodyGfx = scene.add.graphics();

    // Main body rectangle
    bodyGfx.fillStyle(0xddeeff, 1);
    bodyGfx.fillRect(-BODY_W / 2, -BODY_H / 2, BODY_W, BODY_H);

    // Nose cone
    bodyGfx.fillStyle(0xffffff, 0.95);
    bodyGfx.fillTriangle(
      0,           -(BODY_H / 2 + NOSE_H),
      -BODY_W / 2, -BODY_H / 2,
       BODY_W / 2, -BODY_H / 2,
    );

    // Left wing
    bodyGfx.fillStyle(0x88bbee, 0.9);
    bodyGfx.fillTriangle(
      -BODY_W / 2,           BODY_H / 2 - WING_H,
      -BODY_W / 2 - WING_W,  BODY_H / 2,
      -BODY_W / 2,            BODY_H / 2,
    );

    // Right wing
    bodyGfx.fillTriangle(
       BODY_W / 2,           BODY_H / 2 - WING_H,
       BODY_W / 2,            BODY_H / 2,
       BODY_W / 2 + WING_W,  BODY_H / 2,
    );

    // Engine nozzle
    bodyGfx.fillStyle(0x334455, 1);
    bodyGfx.fillRect(-BODY_W / 2, BODY_H / 2 - 4, BODY_W, 4);

    // ── Thruster flame (redrawn each frame) ───────────────────────────────────
    this.thrusterGfx = scene.add.graphics();

    // ── Container ─────────────────────────────────────────────────────────────
    this.container = scene.add.container(x, y, [this.thrusterGfx, bodyGfx]);
    this.container.setDepth(12);

    // ── Labels ────────────────────────────────────────────────────────────────
    this.labelText = scene.add.text(x, y - 34, 'YOU', {
      fontSize: '10px',
      color: '#88ccff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2,
    }).setOrigin(0.5, 1).setDepth(13);

    this.promptText = scene.add.text(x, y - 46, '[E] Inspect', {
      fontSize: '8px',
      color: '#ffdd44',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2,
    }).setOrigin(0.5, 1).setDepth(13).setVisible(false);

    // ── Input ─────────────────────────────────────────────────────────────────
    const kb = scene.input.keyboard!;
    this.keys = {
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.inspectKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.inspectKey.on('down', () => this.tryInspect());
  }

  update(delta: number): void {
    const dt = delta / 1000;

    // ── Rotation ──────────────────────────────────────────────────────────────
    if (this.keys.a.isDown) this.container.angle -= TURN_SPEED * dt;
    if (this.keys.d.isDown) this.container.angle += TURN_SPEED * dt;

    // ── Thrust ────────────────────────────────────────────────────────────────
    const thrusting = this.keys.w.isDown;
    if (thrusting) {
      const rad = Phaser.Math.DegToRad(this.container.angle - 90);
      this.vx += Math.cos(rad) * THRUST * dt;
      this.vy += Math.sin(rad) * THRUST * dt;

      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > MAX_SPEED) {
        const s = MAX_SPEED / speed;
        this.vx *= s;
        this.vy *= s;
      }
    }

    // ── Drag ──────────────────────────────────────────────────────────────────
    const dragFactor = Math.pow(DRAG, delta / 16.67);
    this.vx *= dragFactor;
    this.vy *= dragFactor;

    // ── Integrate position ────────────────────────────────────────────────────
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // ── Planet collision — push out and slide along surface ───────────────────
    for (const planet of this.map.getAllPlanets()) {
      const pp = this.map.getPlanetPixelPos(planet.id);
      const minDist = planet.radius + ROCKET_RADIUS;
      const nx = this.x - pp.x;
      const ny = this.y - pp.y;
      const dist = Math.hypot(nx, ny);
      if (dist < minDist && dist > 0) {
        // Push rocket to surface
        const norm = 1 / dist;
        this.x = pp.x + nx * norm * minDist;
        this.y = pp.y + ny * norm * minDist;
        // Kill the inward velocity component (slide along surface)
        const dot = this.vx * (nx * norm) + this.vy * (ny * norm);
        if (dot < 0) {
          this.vx -= dot * (nx * norm);
          this.vy -= dot * (ny * norm);
        }
      }
    }

    // ── Wrap around map edges ─────────────────────────────────────────────────
    this.x = Phaser.Math.Wrap(this.x, 0, this.mapWidth);
    this.y = Phaser.Math.Wrap(this.y, 0, this.mapHeight);

    // ── Sync container position ───────────────────────────────────────────────
    this.container.setPosition(this.x, this.y);

    // ── Labels ────────────────────────────────────────────────────────────────
    this.labelText.setPosition(this.x, this.y - 34);
    this.promptText.setPosition(this.x, this.y - 46);
    this.promptText.setVisible(this.hasNearbyAgent());

    // ── Thruster flame ────────────────────────────────────────────────────────
    this.drawFlame(thrusting);
  }

  private drawFlame(active: boolean): void {
    const g = this.thrusterGfx;
    g.clear();
    if (!active) return;

    const len  = 12 + Math.random() * 14;
    const wid  = 4  + Math.random() * 3;
    const base = BODY_H / 2;

    // Outer flame (orange)
    g.fillStyle(0xff6600, 0.7);
    g.fillTriangle(-wid / 2, base,  wid / 2, base,  0, base + len);
    // Inner core (yellow-white)
    g.fillStyle(0xffee88, 0.9);
    g.fillTriangle(-(wid / 2) * 0.5, base, (wid / 2) * 0.5, base, 0, base + len * 0.65);
  }

  private tryInspect(): void {
    for (const managed of this.agentManager.getAgents()) {
      const dist = Math.hypot(managed.sprite.x - this.x, managed.sprite.y - this.y);
      if (dist <= INSPECT_RANGE) {
        this.agentManager.pauseAgent(managed.state.id);
        this.scene.events.emit('AGENT_SELECTED', managed.state);
        return;
      }
    }
  }

  private hasNearbyAgent(): boolean {
    return this.agentManager.getAgents().some(m => {
      return Math.hypot(m.sprite.x - this.x, m.sprite.y - this.y) <= INSPECT_RANGE;
    });
  }
}
