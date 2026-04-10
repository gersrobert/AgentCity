import Phaser from 'phaser';
import type { WorldEvent } from '@shared/types';
import { worldState } from '../store/worldState';
import * as backendClient from '../api/backendClient';

export default class ChatPanel {
  private scene: Phaser.Scene;
  private logEl: HTMLElement;
  private statusEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private isRequesting = false;

  constructor(scene: Phaser.Scene, container: HTMLElement) {
    this.scene = scene;
    this.logEl = container.querySelector('#chat-log') as HTMLElement;
    this.statusEl = container.querySelector('#gm-status') as HTMLElement;
    this.inputEl = container.querySelector('#gm-input') as HTMLInputElement;

    const sendBtn = container.querySelector('#gm-send') as HTMLButtonElement;
    sendBtn.addEventListener('click', () => this.handleSubmit());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSubmit();
    });

    this.addLog('system', 'Game master ready. Tell the city what to do...');
  }

  private handleSubmit(): void {
    if (this.isRequesting) return;
    const message = this.inputEl.value.trim();
    if (!message) return;
    this.inputEl.value = '';
    this.sendGMMessage(message);
  }

  private async sendGMMessage(message: string): Promise<void> {
    this.isRequesting = true;
    this.addLog('player', message);
    this.statusEl.textContent = 'Consulting the oracle...';

    try {
      const event = await backendClient.gmChat({ playerMessage: message, worldState });
      this.applyWorldEvent(event);
      this.addLog('gm', event.narrative);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.addLog('error', msg);
    } finally {
      this.isRequesting = false;
      this.statusEl.textContent = '';
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
    this.scene.events.emit('WORLD_EVENT', event);
  }

  private addLog(type: 'player' | 'gm' | 'system' | 'error', message: string): void {
    const colors: Record<string, string> = {
      player: '#88ccff',
      gm: '#aaffaa',
      system: '#888888',
      error: '#ff6644',
    };
    const prefixes: Record<string, string> = {
      player: 'You',
      gm: 'GM',
      system: '•',
      error: 'Error',
    };

    const line = document.createElement('div');
    line.style.cssText = `
      margin-bottom: 8px;
      font-size: 11px;
      line-height: 1.4;
      color: ${colors[type]};
      word-break: break-word;
    `;
    line.innerHTML = `<span style="font-weight:bold">${prefixes[type]}:</span> ${this.escapeHtml(message)}`;
    this.logEl.appendChild(line);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
