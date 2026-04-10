import Phaser from 'phaser';
import type { WorldEvent } from '@shared/types';
import { worldState } from '../store/worldState';
import * as backendClient from '../api/backendClient';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

const PANEL_HEIGHT = 140;
const PANEL_Y = GAME_HEIGHT - PANEL_HEIGHT - 8;
const PANEL_X = 8;
const PANEL_WIDTH = GAME_WIDTH - 16;
const MAX_LOG_LINES = 4;

export default class ChatPanel {
  private scene: Phaser.Scene;
  private bg: Phaser.GameObjects.Graphics;
  private logTexts: Phaser.GameObjects.Text[] = [];
  private logMessages: string[] = [];
  private statusText: Phaser.GameObjects.Text;
  private domInput: Phaser.GameObjects.DOMElement | null = null;
  private isRequesting = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.bg = scene.add.graphics();
    this.bg.setScrollFactor(0);
    this.bg.setDepth(100);
    this.drawBackground();

    this.statusText = scene.add.text(
      PANEL_X + 10,
      PANEL_Y + PANEL_HEIGHT - 20,
      '',
      { fontSize: '9px', color: '#ffaa44', resolution: 2 }
    );
    this.statusText.setScrollFactor(0);
    this.statusText.setDepth(101);

    this.createDOMInput();
    this.addLog('Game master chat ready. Tell the city what to do...');
  }

  private drawBackground(): void {
    this.bg.clear();
    this.bg.fillStyle(0x1a1a2e, 0.88);
    this.bg.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT, 8);
    this.bg.lineStyle(2, 0x6644aa, 1);
    this.bg.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT, 8);
  }

  private createDOMInput(): void {
    const html = `
      <div style="display:flex;gap:6px;align-items:center;">
        <input
          id="gm-input"
          type="text"
          placeholder="Command the city... (e.g. make it rain)"
          style="
            flex:1;
            background:#0d0d1a;
            color:#ffffff;
            border:1px solid #6644aa;
            border-radius:4px;
            padding:4px 8px;
            font-size:11px;
            font-family:monospace;
            outline:none;
          "
        />
        <button
          id="gm-send"
          style="
            background:#6644aa;
            color:#fff;
            border:none;
            border-radius:4px;
            padding:4px 10px;
            font-size:11px;
            cursor:pointer;
          "
        >Send</button>
      </div>
    `;

    this.domInput = this.scene.add.dom(
      PANEL_X + PANEL_WIDTH / 2,
      PANEL_Y + PANEL_HEIGHT - 26
    ).createFromHTML(html);
    this.domInput.setScrollFactor(0);
    this.domInput.setDepth(102);
    this.domInput.setOrigin(0.5, 0.5);

    this.domInput.addListener('click');
    this.domInput.on('click', (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.id === 'gm-send') {
        this.handleSubmit();
      }
    });

    // Enter key
    this.domInput.addListener('keydown');
    this.domInput.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        this.handleSubmit();
      }
    });
  }

  private handleSubmit(): void {
    if (this.isRequesting) return;

    const input = document.getElementById('gm-input') as HTMLInputElement | null;
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    this.sendGMMessage(message);
  }

  private async sendGMMessage(message: string): Promise<void> {
    this.isRequesting = true;
    this.addLog(`You: ${message}`);
    this.statusText.setText('Consulting the oracle...');

    try {
      const event = await backendClient.gmChat({
        playerMessage: message,
        worldState,
      });

      this.applyWorldEvent(event);
      this.addLog(`GM: ${event.narrative}`);
      this.statusText.setText('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.addLog(`Error: ${msg}`);
      this.statusText.setText('');
    } finally {
      this.isRequesting = false;
    }
  }

  private applyWorldEvent(event: WorldEvent): void {
    const { stateChanges } = event;
    if (stateChanges.weather) worldState.weather = stateChanges.weather;
    if (stateChanges.timeOfDay) worldState.timeOfDay = stateChanges.timeOfDay;
    if (stateChanges.activeEvents) worldState.activeEvents = stateChanges.activeEvents;
    if (stateChanges.agentMoodOverrides) {
      for (const [agentId, mood] of Object.entries(stateChanges.agentMoodOverrides)) {
        const agent = worldState.agents.find((a) => a.id === agentId);
        if (agent) agent.mood = mood;
      }
    }

    // Broadcast the event to GameScene
    this.scene.events.emit('WORLD_EVENT', event);
  }

  private addLog(message: string): void {
    this.logMessages.push(message);
    if (this.logMessages.length > MAX_LOG_LINES) {
      this.logMessages.shift();
    }
    this.renderLog();
  }

  private renderLog(): void {
    for (const t of this.logTexts) t.destroy();
    this.logTexts = [];

    this.logMessages.forEach((msg, i) => {
      const t = this.scene.add.text(
        PANEL_X + 10,
        PANEL_Y + 10 + i * 20,
        msg,
        {
          fontSize: '10px',
          color: '#dddddd',
          wordWrap: { width: PANEL_WIDTH - 20 },
          resolution: 2,
        }
      );
      t.setScrollFactor(0);
      t.setDepth(101);
      this.logTexts.push(t);
    });
  }
}
