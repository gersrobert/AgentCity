import Phaser from 'phaser';
import type { AgentState, Mood } from '@shared/types';
import { TILE_SIZE, THOUGHT_BUBBLE_DURATION_MS } from '../config';

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

const AGENT_TINTS = [0xff9999, 0x99ccff, 0xaaffaa, 0xffcc88];

export default class AgentSprite {
  readonly id: string;
  private scene: Phaser.Scene;
  private circle: Phaser.GameObjects.Graphics;
  private nameLabel: Phaser.GameObjects.Text;
  private moodDot: Phaser.GameObjects.Graphics;
  private thoughtContainer: Phaser.GameObjects.Container | null = null;
  private thoughtTimer: Phaser.Time.TimerEvent | null = null;

  x: number;
  y: number;

  constructor(
    scene: Phaser.Scene,
    agentState: AgentState,
    agentIndex: number
  ) {
    this.id = agentState.id;
    this.scene = scene;

    const worldPos = {
      x: agentState.position.tileX * TILE_SIZE + TILE_SIZE / 2,
      y: agentState.position.tileY * TILE_SIZE + TILE_SIZE / 2,
    };

    this.x = worldPos.x;
    this.y = worldPos.y;

    // Agent body (colored circle)
    const tint = AGENT_TINTS[agentIndex % AGENT_TINTS.length];
    this.circle = scene.add.graphics();
    this.circle.setDepth(10);
    this.drawBody(tint);

    // Name label
    this.nameLabel = scene.add.text(worldPos.x, worldPos.y - 28, agentState.name, {
      fontSize: '10px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2,
    });
    this.nameLabel.setOrigin(0.5, 1);
    this.nameLabel.setDepth(11);

    // Mood dot
    this.moodDot = scene.add.graphics();
    this.moodDot.setDepth(11);
    this.updateMoodColor(agentState.mood);

    this.setPosition(worldPos.x, worldPos.y);

    // Make interactive for clicking
    const hitArea = new Phaser.Geom.Circle(0, 0, TILE_SIZE * 0.7);
    this.circle.setInteractive(hitArea, Phaser.Geom.Circle.Contains);
  }

  private drawBody(tint: number): void {
    this.circle.clear();
    this.circle.fillStyle(tint, 1);
    this.circle.fillCircle(0, 0, TILE_SIZE * 0.55);
    this.circle.lineStyle(2, 0x000000, 1);
    this.circle.strokeCircle(0, 0, TILE_SIZE * 0.55);

    // Simple face dots
    this.circle.fillStyle(0x222222, 1);
    this.circle.fillCircle(-5, -3, 2);
    this.circle.fillCircle(5, -3, 2);
    // Smile
    this.circle.lineStyle(2, 0x222222, 1);
    this.circle.beginPath();
    this.circle.arc(0, 2, 5, 0, Math.PI, false);
    this.circle.strokePath();
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.circle.setPosition(x, y);
    this.nameLabel.setPosition(x, y - 22);
    this.moodDot.setPosition(x + 12, y - 12);

    if (this.thoughtContainer) {
      this.thoughtContainer.setPosition(x, y - 50);
    }
  }

  updateMoodColor(mood: Mood): void {
    const color = MOOD_COLORS[mood] ?? 0xffffff;
    this.moodDot.clear();
    this.moodDot.fillStyle(color, 1);
    this.moodDot.fillCircle(0, 0, 5);
    this.moodDot.lineStyle(1.5, 0x000000, 1);
    this.moodDot.strokeCircle(0, 0, 5);
  }

  showThoughtBubble(text: string): void {
    // Clear existing bubble
    if (this.thoughtContainer) {
      this.thoughtContainer.destroy();
      this.thoughtContainer = null;
    }
    if (this.thoughtTimer) {
      this.thoughtTimer.destroy();
      this.thoughtTimer = null;
    }

    const maxWidth = 140;
    const padding = 8;

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
    bg.fillStyle(0xffffff, 0.95);
    bg.fillRoundedRect(-tw / 2, -th / 2, tw, th, 6);
    bg.lineStyle(1.5, 0x444444, 1);
    bg.strokeRoundedRect(-tw / 2, -th / 2, tw, th, 6);
    // Tail
    bg.fillStyle(0xffffff, 0.95);
    bg.fillTriangle(-4, th / 2, 4, th / 2, 0, th / 2 + 8);
    bg.lineStyle(1.5, 0x444444, 1);
    bg.strokeTriangle(-4, th / 2, 4, th / 2, 0, th / 2 + 8);

    this.thoughtContainer = this.scene.add.container(this.x, this.y - 50, [
      bg,
      bubbleText,
    ]);
    this.thoughtContainer.setDepth(20);

    this.thoughtTimer = this.scene.time.delayedCall(
      THOUGHT_BUBBLE_DURATION_MS,
      () => {
        if (this.thoughtContainer) {
          this.thoughtContainer.destroy();
          this.thoughtContainer = null;
        }
        this.thoughtTimer = null;
      }
    );
  }

  getCircle(): Phaser.GameObjects.Graphics {
    return this.circle;
  }

  destroy(): void {
    this.circle.destroy();
    this.nameLabel.destroy();
    this.moodDot.destroy();
    if (this.thoughtContainer) this.thoughtContainer.destroy();
    if (this.thoughtTimer) this.thoughtTimer.destroy();
  }
}
