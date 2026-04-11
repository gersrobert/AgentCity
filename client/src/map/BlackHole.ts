import Phaser from 'phaser';

// ─── Sizing ───────────────────────────────────────────────────────────────────
// All geometry is drawn at BASE_RADIUS = 100 (event horizon).
// A Phaser Container is scaled to make it larger/smaller.
const BASE_RADIUS = 100;
const MIN_SCALE = 0.06;   // event horizon starts at 6 px radius
const MAX_SCALE = 1.50;   // event horizon at full size = 150 px radius

// ─── Breathing ────────────────────────────────────────────────────────────────
const BREATHE_AMOUNT = 0.04;   // ±4 % of current scale
const BREATHE_PERIOD = 2_400;  // ms per full breath

export default class BlackHole {
  readonly x: number;
  readonly y: number;

  private container: Phaser.GameObjects.Container;
  private elapsed = 0;
  // 0–1 fraction of maximum size, driven by agent deliveries
  private sizeFraction = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;

    // ── Layer 1: tight dark-red inner glow ─────────────────────────────────
    const glowGfx = scene.add.graphics();
    glowGfx.fillStyle(0x5a0008, 0.32); glowGfx.fillCircle(0, 0, 148);
    glowGfx.fillStyle(0x780010, 0.40); glowGfx.fillCircle(0, 0, 126);

    // ── Layer 2: corona — deep-red → orange transition ──────────────────
    const coronaGfx = scene.add.graphics();
    coronaGfx.fillStyle(0xaa1500, 0.55); coronaGfx.fillCircle(0, 0, 118);
    coronaGfx.fillStyle(0xdd2200, 0.65); coronaGfx.fillCircle(0, 0, 113);
    coronaGfx.fillStyle(0xff4400, 0.55); coronaGfx.fillCircle(0, 0, 109);
    coronaGfx.fillStyle(0xff6600, 0.38); coronaGfx.fillCircle(0, 0, 106);
    coronaGfx.fillStyle(0xff8800, 0.20); coronaGfx.fillCircle(0, 0, 103);

    // ── Layer 3: event horizon — pure black ──────────────────────────────
    const coreGfx = scene.add.graphics();
    coreGfx.fillStyle(0x000000, 1.0);
    coreGfx.fillCircle(0, 0, BASE_RADIUS);

    // ── Layer 4: photon ring — thin bright ring just above the horizon ───
    const ringGfx = scene.add.graphics();
    ringGfx.lineStyle(2.5, 0xffcc44, 0.85);
    ringGfx.strokeCircle(0, 0, BASE_RADIUS + 5);
    ringGfx.lineStyle(1.5, 0xffffff, 0.45);
    ringGfx.strokeCircle(0, 0, BASE_RADIUS + 8);

    // ── Container groups all layers ──────────────────────────────────────
    this.container = scene.add.container(x, y, [glowGfx, coronaGfx, coreGfx, ringGfx]);
    this.container.setDepth(6);
    this.container.setScale(MIN_SCALE);

    // Corona pulse — gently brightens and dims
    scene.tweens.add({
      targets: coronaGfx,
      alpha: { from: 0.7, to: 1.0 },
      duration: 1_600,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });

    // Photon ring flicker — quick subtle pulse
    scene.tweens.add({
      targets: ringGfx,
      alpha: { from: 0.55, to: 1.0 },
      duration: 750,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
      delay: 200,
    });

    // Outer glow slow breathe
    scene.tweens.add({
      targets: glowGfx,
      alpha: { from: 0.85, to: 1.0 },
      duration: 3_200,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /** Called when an agent delivers an illegal item. fraction is 0–1 total size. */
  setSizeFraction(fraction: number): void {
    this.sizeFraction = Math.min(1, Math.max(0, fraction));
  }

  update(delta: number): void {
    this.elapsed += delta;

    const growthScale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * this.sizeFraction;

    // Breathing sine on top of growth
    const breathe = 1 + Math.sin((this.elapsed / BREATHE_PERIOD) * Math.PI * 2) * BREATHE_AMOUNT;

    this.container.setScale(growthScale * breathe);
  }

  /** Radius of the event horizon in world pixels */
  getRadius(): number {
    return BASE_RADIUS * this.container.scaleX;
  }
}
