import Phaser from 'phaser';

// ── Tuning ────────────────────────────────────────────────────────────────────
const TURN_SPEED      = 180;   // degrees per second while A/D held
const THRUST          = 320;   // pixels per second² acceleration
const MAX_SPEED       = 420;   // pixels per second (terminal velocity)
const DRAG            = 0.97;  // velocity multiplier applied each frame (< 1 = friction)
const THRUSTER_ALPHA  = 0.85;  // base alpha for the engine flame

// ── Rocket geometry (drawn at origin, pointing UP) ────────────────────────────
// Body: a thin tall rectangle
const BODY_W = 10;
const BODY_H = 22;
// Nose: small triangle on top
const NOSE_H = 10;
// Wing: two small angled fins at the bottom
const WING_W = 8;
const WING_H = 7;

export default class RocketController {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private thrusterGfx: Phaser.GameObjects.Graphics;
  private keys: {
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  };

  // Physics state
  private vx = 0;
  private vy = 0;

  // Map bounds (for wrapping / clamping)
  private mapWidth: number;
  private mapHeight: number;

  constructor(scene: Phaser.Scene, x: number, y: number, mapWidth: number, mapHeight: number) {
    this.scene = scene;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    // ── Body ──────────────────────────────────────────────────────────────────
    const bodyGfx = scene.add.graphics();

    // Main body rectangle
    bodyGfx.fillStyle(0xddeeff, 1);
    bodyGfx.fillRect(-BODY_W / 2, -BODY_H / 2, BODY_W, BODY_H);

    // Nose cone (triangle above body)
    bodyGfx.fillStyle(0xffffff, 0.95);
    bodyGfx.fillTriangle(
      0,          -(BODY_H / 2 + NOSE_H),  // tip
      -BODY_W / 2, -BODY_H / 2,             // bottom-left
       BODY_W / 2, -BODY_H / 2,             // bottom-right
    );

    // Left wing
    bodyGfx.fillStyle(0x88bbee, 0.9);
    bodyGfx.fillTriangle(
      -BODY_W / 2,          BODY_H / 2 - WING_H,
      -BODY_W / 2 - WING_W, BODY_H / 2,
      -BODY_W / 2,          BODY_H / 2,
    );

    // Right wing
    bodyGfx.fillTriangle(
       BODY_W / 2,          BODY_H / 2 - WING_H,
       BODY_W / 2,          BODY_H / 2,
       BODY_W / 2 + WING_W, BODY_H / 2,
    );

    // Engine nozzle (dark band at bottom)
    bodyGfx.fillStyle(0x334455, 1);
    bodyGfx.fillRect(-BODY_W / 2, BODY_H / 2 - 4, BODY_W, 4);

    // ── Thruster flame (drawn behind body, updated each frame) ────────────────
    this.thrusterGfx = scene.add.graphics();

    // ── Container ─────────────────────────────────────────────────────────────
    // thrusterGfx first so it renders behind the body
    this.container = scene.add.container(x, y, [this.thrusterGfx, bodyGfx]);
    this.container.setDepth(12);

    // ── Input ─────────────────────────────────────────────────────────────────
    const kb = scene.input.keyboard!;
    this.keys = {
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  update(delta: number): void {
    const dt = delta / 1000; // seconds

    // ── Rotation ──────────────────────────────────────────────────────────────
    if (this.keys.a.isDown) this.container.angle -= TURN_SPEED * dt;
    if (this.keys.d.isDown) this.container.angle += TURN_SPEED * dt;

    // ── Thrust ────────────────────────────────────────────────────────────────
    const thrusting = this.keys.w.isDown;
    if (thrusting) {
      // Facing direction: container.rotation is clockwise from up (−90° offset)
      const rad = Phaser.Math.DegToRad(this.container.angle - 90);
      this.vx += Math.cos(rad) * THRUST * dt;
      this.vy += Math.sin(rad) * THRUST * dt;

      // Clamp to max speed
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > MAX_SPEED) {
        const scale = MAX_SPEED / speed;
        this.vx *= scale;
        this.vy *= scale;
      }
    }

    // ── Drag (inertia bleeds off slowly) ─────────────────────────────────────
    this.vx *= Math.pow(DRAG, delta / 16.67); // frame-rate independent
    this.vy *= Math.pow(DRAG, delta / 16.67);

    // ── Integrate position ────────────────────────────────────────────────────
    this.container.x += this.vx * dt;
    this.container.y += this.vy * dt;

    // Wrap around map edges
    this.container.x = Phaser.Math.Wrap(this.container.x, 0, this.mapWidth);
    this.container.y = Phaser.Math.Wrap(this.container.y, 0, this.mapHeight);

    // ── Thruster flame ────────────────────────────────────────────────────────
    this.drawFlame(thrusting);
  }

  private drawFlame(active: boolean): void {
    const g = this.thrusterGfx;
    g.clear();
    if (!active) return;

    // Flicker: randomise length and width a little each frame
    const len  = 12 + Math.random() * 14;
    const wid  = 4  + Math.random() * 3;
    const base = BODY_H / 2;          // bottom of the body

    // Outer flame (orange)
    g.fillStyle(0xff6600, THRUSTER_ALPHA * 0.7);
    g.fillTriangle(-wid / 2, base,  wid / 2, base,  0, base + len);

    // Inner flame (bright yellow-white core)
    g.fillStyle(0xffee88, THRUSTER_ALPHA);
    g.fillTriangle(-(wid / 2) * 0.5, base, (wid / 2) * 0.5, base, 0, base + len * 0.65);
  }

  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }
}
