import Phaser from "phaser";
import CityMap from "../map/CityMap";
import AgentManager from "../agents/AgentManager";
import BlackHole from "../map/BlackHole";
import AudioManager from "../audio/AudioManager";
import { worldState } from "../store/worldState";

// ── Tuning ────────────────────────────────────────────────────────────────────
const TURN_SPEED = 180; // degrees per second while A/D held
const THRUST = 320; // px/s² acceleration
const MAX_SPEED = 420; // px/s terminal velocity
const DRAG = 0.98; // velocity multiplier per frame (friction)
const INSPECT_RANGE = 90; // px from rocket centre to agent centre

// Ship display size (height in px; width scales proportionally from 421×387 source)
const SHIP_HEIGHT = 34;
const SHIP_WIDTH = Math.round(SHIP_HEIGHT * (421 / 387)); // ≈ 37
const ROCKET_RADIUS = SHIP_HEIGHT * 0.3; // collision radius

export default class RocketController {
  // World position (used externally for inspect checks etc.)
  x = 0;
  y = 0;

  private scene: Phaser.Scene;
  private map: CityMap;
  private agentManager: AgentManager;
  private blackHole: BlackHole | null = null;

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
  private inspecting = false;

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

    // ── Ship image ────────────────────────────────────────────────────────────
    const shipImg = scene.add.image(0, 0, "player_ship");
    shipImg.setDisplaySize(SHIP_WIDTH, SHIP_HEIGHT);

    // ── Thruster flame (redrawn each frame, sits behind the ship) ─────────────
    this.thrusterGfx = scene.add.graphics();

    // ── Container ─────────────────────────────────────────────────────────────
    // thrusterGfx first so it renders behind the ship
    this.container = scene.add.container(x, y, [this.thrusterGfx, shipImg]);
    this.container.setDepth(12);

    // ── Labels ────────────────────────────────────────────────────────────────
    this.labelText = scene.add
      .text(x, y - 34, "YOU", {
        fontSize: "10px",
        color: "#88ccff",
        stroke: "#000000",
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(13);

    this.promptText = scene.add
      .text(x, y - 46, "[E] Inspect", {
        fontSize: "8px",
        color: "#ffdd44",
        stroke: "#000000",
        strokeThickness: 2,
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(13)
      .setVisible(false);

    // ── Input ─────────────────────────────────────────────────────────────────
    const kb = scene.input.keyboard!;
    this.keys = {
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.inspectKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.inspectKey.on("down", () => this.tryInspect());
  }

  setBlackHole(bh: BlackHole): void {
    this.blackHole = bh;
  }

  setInspecting(active: boolean): void {
    this.inspecting = active;
    if (active) {
      this.vx = 0;
      this.vy = 0;
    }
  }

  update(delta: number): void {
    const dt = delta / 1000;

    // ── Rotation ──────────────────────────────────────────────────────────────
    if (!this.inspecting && this.keys.a.isDown) this.container.angle -= TURN_SPEED * dt;
    if (!this.inspecting && this.keys.d.isDown) this.container.angle += TURN_SPEED * dt;

    // ── Thrust ────────────────────────────────────────────────────────────────
    const thrusting = !this.inspecting && this.keys.w.isDown;
    AudioManager.getInstance().setRocketThrusting(thrusting);
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

    // ── Planet collision — only active (spawned) planets ─────────────────────
    const activePlanetIds = new Set(worldState.locations.map(l => l.id));
    for (const planet of this.map.getAllPlanets()) {
      if (!activePlanetIds.has(planet.id)) continue;
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

    // ── Blackhole collision — push out and slide along surface ────────────────
    if (this.blackHole) {
      const minDist = this.blackHole.getRadius() + ROCKET_RADIUS;
      const nx = this.x - this.blackHole.x;
      const ny = this.y - this.blackHole.y;
      const dist = Math.hypot(nx, ny);
      if (dist < minDist && dist > 0) {
        const norm = 1 / dist;
        this.x = this.blackHole.x + nx * norm * minDist;
        this.y = this.blackHole.y + ny * norm * minDist;
        const dot = this.vx * (nx * norm) + this.vy * (ny * norm);
        if (dot < 0) {
          this.vx -= dot * (nx * norm);
          this.vy -= dot * (ny * norm);
        }
      }
    }

    // ── Hard map borders — clamp position and kill outward velocity ───────────
    if (this.x < ROCKET_RADIUS) { this.x = ROCKET_RADIUS; if (this.vx < 0) this.vx = 0; }
    if (this.x > this.mapWidth - ROCKET_RADIUS) { this.x = this.mapWidth - ROCKET_RADIUS; if (this.vx > 0) this.vx = 0; }
    if (this.y < ROCKET_RADIUS) { this.y = ROCKET_RADIUS; if (this.vy < 0) this.vy = 0; }
    if (this.y > this.mapHeight - ROCKET_RADIUS) { this.y = this.mapHeight - ROCKET_RADIUS; if (this.vy > 0) this.vy = 0; }

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

    const len = 18 + Math.random() * 20;
    const wid = 6 + Math.random() * 6;
    const base = SHIP_HEIGHT / 2;

    // Outer flame (orange)
    g.fillStyle(0xff6600, 0.7);
    g.fillTriangle(-wid / 2, base, wid / 2, base, 0, base + len);
    // Inner core (yellow-white)
    g.fillStyle(0xffee88, 0.9);
    g.fillTriangle(
      -(wid / 2) * 0.5,
      base,
      (wid / 2) * 0.5,
      base,
      0,
      base + len * 0.65,
    );
  }

  private tryInspect(): void {
    for (const managed of this.agentManager.getAgents()) {
      const dist = Math.hypot(
        managed.sprite.x - this.x,
        managed.sprite.y - this.y,
      );
      if (dist <= INSPECT_RANGE) {
        this.agentManager.openInspection(managed.state.id);
        return;
      }
    }
  }

  private hasNearbyAgent(): boolean {
    return this.agentManager.getAgents().some((m) => {
      return (
        Math.hypot(m.sprite.x - this.x, m.sprite.y - this.y) <= INSPECT_RANGE
      );
    });
  }
}
