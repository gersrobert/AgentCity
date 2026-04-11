import Phaser from 'phaser';
import type { AgentState, Mood } from '@shared/types';
import { THOUGHT_BUBBLE_DURATION_MS } from '../config';

const MOOD_COLORS: Record<Mood, number> = {
  happy: 0xffdd44,
  excited: 0xff8800,
  curious: 0x44ddff,
  content: 0x88cc44,
  bored: 0xaaaaaa,
  anxious: 0xff6644,
  sad: 0x4488ff,
  angry: 0xff2222,
};

// Each agent gets a distinct colour
const ORB_COLORS = [0x44ffdd, 0xff88cc, 0xffcc44, 0x88aaff];

export default class AgentSprite {
  readonly id: string;

  // Current world position (written by orbit logic or travel tween)
  x: number = 0;
  y: number = 0;

  private scene: Phaser.Scene;
  private orbColor: number;

  // Visual objects
  private orbGfx: Phaser.GameObjects.Graphics;
  private moodGfx: Phaser.GameObjects.Graphics;
  private nameLabel: Phaser.GameObjects.Text;
  private thoughtContainer: Phaser.GameObjects.Container | null = null;
  private thoughtTimer: Phaser.Time.TimerEvent | null = null;
  trailGfx: Phaser.GameObjects.Graphics;

  // Orbit state (active when not traveling)
  orbitAngle: number;
  orbitRadius: number;
  orbitSpeed: number; // rad / ms
  planetX: number;
  planetY: number;
  traveling = false;

  // Trail
  private trailPoints: { x: number; y: number }[] = [];

  constructor(
    scene: Phaser.Scene,
    agentState: AgentState,
    planetX: number,
    planetY: number,
    planetRadius: number,
    agentIndex: number,
  ) {
    this.id = agentState.id;
    this.scene = scene;
    this.orbColor = ORB_COLORS[agentIndex % ORB_COLORS.length];

    this.planetX = planetX;
    this.planetY = planetY;
    this.orbitRadius = planetRadius + 22;
    this.orbitAngle = agentIndex * 2.1; // stagger starting angles
    this.orbitSpeed = 0.00055 + agentIndex * 0.00008;

    this.x = planetX + Math.cos(this.orbitAngle) * this.orbitRadius;
    this.y = planetY + Math.sin(this.orbitAngle) * this.orbitRadius;

    // Build graphics objects (low depth → high depth)
    this.trailGfx = scene.add.graphics().setDepth(8);
    this.orbGfx = scene.add.graphics().setDepth(10);
    this.moodGfx = scene.add.graphics().setDepth(11);
    this.nameLabel = scene.add
      .text(this.x, this.y - 22, agentState.name, {
        fontSize: '10px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(11);

    this.drawOrb();
    this.updateMoodColor(agentState.mood);
    this.syncVisuals();

    // Clickable hit area on the orb graphics
    const hitCircle = new Phaser.Geom.Circle(0, 0, 20);
    this.orbGfx.setInteractive(hitCircle, Phaser.Geom.Circle.Contains);
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────

  private drawOrb(): void {
    this.orbGfx.clear();
    // Outer soft halo
    this.orbGfx.fillStyle(this.orbColor, 0.08);
    this.orbGfx.fillCircle(0, 0, 22);
    // Mid glow
    this.orbGfx.fillStyle(this.orbColor, 0.25);
    this.orbGfx.fillCircle(0, 0, 13);
    // Core
    this.orbGfx.fillStyle(this.orbColor, 0.85);
    this.orbGfx.fillCircle(0, 0, 6);
    // Bright centre spark
    this.orbGfx.fillStyle(0xffffff, 0.9);
    this.orbGfx.fillCircle(0, 0, 2);
  }

  updateMoodColor(mood: Mood): void {
    const color = MOOD_COLORS[mood] ?? 0xffffff;
    this.moodGfx.clear();
    this.moodGfx.fillStyle(color, 0.95);
    this.moodGfx.fillCircle(0, 0, 4);
    this.moodGfx.lineStyle(1, 0x000000, 0.6);
    this.moodGfx.strokeCircle(0, 0, 4);
  }

  // ─── Orbit update (called every frame while not traveling) ─────────────────

  updateOrbit(delta: number): void {
    if (this.traveling) return;
    this.orbitAngle += this.orbitSpeed * delta;
    this.x = this.planetX + Math.cos(this.orbitAngle) * this.orbitRadius;
    this.y = this.planetY + Math.sin(this.orbitAngle) * this.orbitRadius;
    this.syncVisuals();
  }

  // ─── Called each frame during travel to draw the trail ────────────────────

  updateTrail(): void {
    if (!this.traveling) {
      if (this.trailPoints.length > 0) {
        this.trailPoints = [];
        this.trailGfx.clear();
      }
      return;
    }

    this.trailPoints.push({ x: this.x, y: this.y });
    if (this.trailPoints.length > 50) this.trailPoints.shift();

    this.trailGfx.clear();
    for (let i = 1; i < this.trailPoints.length; i++) {
      const t = i / this.trailPoints.length;
      const alpha = t * 0.65;
      const size = 1 + t * 2.5;
      this.trailGfx.fillStyle(this.orbColor, alpha);
      this.trailGfx.fillCircle(this.trailPoints[i].x, this.trailPoints[i].y, size);
    }
  }

  // ─── Called when agent arrives at a new planet ────────────────────────────

  arriveAtPlanet(px: number, py: number, planetRadius: number): void {
    this.traveling = false;
    this.planetX = px;
    this.planetY = py;
    this.orbitRadius = planetRadius + 22;
    this.trailPoints = [];
    this.trailGfx.clear();
  }

  // ─── Sync all visual objects to current x/y ───────────────────────────────

  syncVisuals(): void {
    this.orbGfx.setPosition(this.x, this.y);
    this.nameLabel.setPosition(this.x, this.y - 22);
    this.moodGfx.setPosition(this.x + 10, this.y - 10);
    if (this.thoughtContainer) {
      this.thoughtContainer.setPosition(this.x, this.y - 48);
    }
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.syncVisuals();
  }

  // ─── Thought bubble ───────────────────────────────────────────────────────

  showThoughtBubble(text: string): void {
    if (this.thoughtContainer) {
      this.thoughtContainer.destroy();
      this.thoughtContainer = null;
    }
    if (this.thoughtTimer) {
      this.thoughtTimer.destroy();
      this.thoughtTimer = null;
    }

    const padding = 8;
    const maxWidth = 150;

    const bubbleText = this.scene.add.text(0, 0, text, {
      fontSize: '9px',
      color: '#222222',
      wordWrap: { width: maxWidth - padding * 2 },
      align: 'center',
      resolution: 2,
    });
    bubbleText.setOrigin(0.5, 0.5);

    const tw = bubbleText.width + padding * 2;
    const th = bubbleText.height + padding * 2;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0xeeeeff, 0.92);
    bg.fillRoundedRect(-tw / 2, -th / 2, tw, th, 5);
    bg.lineStyle(1.5, this.orbColor, 0.8);
    bg.strokeRoundedRect(-tw / 2, -th / 2, tw, th, 5);
    // Signal tail toward the orb
    bg.fillStyle(0xeeeeff, 0.92);
    bg.fillTriangle(-3, th / 2, 3, th / 2, 0, th / 2 + 7);
    bg.lineStyle(1.5, this.orbColor, 0.8);
    bg.strokeTriangle(-3, th / 2, 3, th / 2, 0, th / 2 + 7);

    this.thoughtContainer = this.scene.add.container(this.x, this.y - 48, [bg, bubbleText]);
    this.thoughtContainer.setDepth(20);

    this.thoughtTimer = this.scene.time.delayedCall(THOUGHT_BUBBLE_DURATION_MS, () => {
      this.thoughtContainer?.destroy();
      this.thoughtContainer = null;
      this.thoughtTimer = null;
    });
  }

  getGraphics(): Phaser.GameObjects.Graphics {
    return this.orbGfx;
  }

  destroy(): void {
    this.orbGfx.destroy();
    this.moodGfx.destroy();
    this.nameLabel.destroy();
    this.trailGfx.destroy();
    this.thoughtContainer?.destroy();
    this.thoughtTimer?.destroy();
  }
}
