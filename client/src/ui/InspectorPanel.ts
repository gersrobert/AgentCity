import Phaser from 'phaser';
import type { AgentState, Mood } from '@shared/types';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

const PANEL_WIDTH = 200;
const PANEL_X = GAME_WIDTH - PANEL_WIDTH - 8;
const PANEL_Y = 8;
const PANEL_HEIGHT = 240;

const MOOD_EMOJI: Record<Mood, string> = {
  happy: ':)',
  excited: ':D',
  curious: ':o',
  content: ':-)',
  bored: ':|',
  anxious: ':S',
  sad: ':(',
  angry: '>:(',
};

export default class InspectorPanel {
  private scene: Phaser.Scene;
  private bg: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.bg = scene.add.graphics();
    this.bg.setScrollFactor(0);
    this.bg.setDepth(100);

    this.drawBackground();
    this.hide();
  }

  private drawBackground(): void {
    this.bg.clear();
    this.bg.fillStyle(0x1a1a2e, 0.9);
    this.bg.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT, 8);
    this.bg.lineStyle(2, 0x6644aa, 1);
    this.bg.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT, 8);
  }

  show(agent: AgentState): void {
    this.visible = true;
    this.bg.setVisible(true);
    this.clearTexts();

    const px = PANEL_X + 10;
    let py = PANEL_Y + 12;
    const lineHeight = 18;

    const addText = (content: string, style: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) => {
      const t = this.scene.add.text(px, py, content, {
        fontSize: '11px',
        color: '#ffffff',
        wordWrap: { width: PANEL_WIDTH - 20 },
        resolution: 2,
        ...style,
      });
      t.setScrollFactor(0);
      t.setDepth(101);
      this.texts.push(t);
      py += t.height + 4;
    };

    addText(agent.name, { fontSize: '14px', color: '#ffdd44' });
    addText(`Mood: ${agent.mood} ${MOOD_EMOJI[agent.mood] ?? ''}`, {
      color: '#aaffaa',
    });
    py += 4;
    addText('Personality:', { color: '#aaaaff' });
    addText(agent.personality, { fontSize: '9px', color: '#cccccc' });
    py += 4;
    addText('Goal:', { color: '#aaaaff' });
    addText(agent.currentGoal, { fontSize: '9px', color: '#cccccc' });
    py += 4;
    addText('Thinking:', { color: '#aaaaff' });
    addText(`"${agent.currentThought}"`, {
      fontSize: '9px',
      color: '#ffffcc',
      fontStyle: 'italic',
    });
  }

  update(agent: AgentState): void {
    if (this.visible) {
      this.show(agent);
    }
  }

  hide(): void {
    this.visible = false;
    this.bg.setVisible(false);
    this.clearTexts();
  }

  isVisible(): boolean {
    return this.visible;
  }

  private clearTexts(): void {
    for (const t of this.texts) t.destroy();
    this.texts = [];
  }
}
