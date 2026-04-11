import Phaser from 'phaser';
import * as backendClient from '../api/backendClient';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { worldState } from '../store/worldState';
import AudioManager from '../audio/AudioManager';

export default class ApiKeyScene extends Phaser.Scene {
  private errorText: Phaser.GameObjects.Text | null = null;
  private domElement: Phaser.GameObjects.DOMElement | null = null;

  constructor() {
    super({ key: 'ApiKeyScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Background overlay
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRect(0, 0, width, height);

    // Title
    this.add.text(width / 2, height / 2 - 100, 'AgentCity', {
      fontSize: '36px',
      color: '#ffdd44',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 60, 'Enter your Anthropic API key to begin', {
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // DOM input form
    const formHtml = `
      <div style="display:flex;flex-direction:column;gap:10px;align-items:center;width:380px;">
        <input
          id="api-key-input"
          type="password"
          placeholder="Paste your API key..."
          autocomplete="off"
          style="
            width:100%;
            background:#0d0d1a;
            color:#ffffff;
            border:2px solid #6644aa;
            border-radius:6px;
            padding:10px 14px;
            font-size:13px;
            font-family:monospace;
            outline:none;
            text-align:center;
          "
        />
        <button
          id="api-key-submit"
          style="
            width:100%;
            background:#6644aa;
            color:#fff;
            border:none;
            border-radius:6px;
            padding:10px;
            font-size:14px;
            cursor:pointer;
            font-weight:bold;
          "
        >Enter the City</button>
        <p id="api-key-error" style="color:#ff6644;font-size:12px;margin:0;min-height:16px;"></p>
      </div>
    `;

    this.domElement = this.add.dom(width / 2, height / 2 + 10).createFromHTML(formHtml);
    this.domElement.setDepth(10);

    this.domElement.addListener('click');
    this.domElement.on('click', (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.id === 'api-key-submit') {
        this.handleSubmit();
      }
    });

    this.domElement.addListener('keydown');
    this.domElement.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        this.handleSubmit();
      }
    });

    // Note about key security
    this.add.text(width / 2, height / 2 + 90, 'Your key is stored in memory only and never persisted.', {
      fontSize: '10px',
      color: '#555577',
    }).setOrigin(0.5);
  }

  private async handleSubmit(): Promise<void> {
    const input = document.getElementById('api-key-input') as HTMLInputElement | null;
    const errorEl = document.getElementById('api-key-error') as HTMLElement | null;

    if (!input || !errorEl) return;

    const apiKey = input.value.trim();

    if (!apiKey) {
      errorEl.textContent = 'Please enter your API key.';
      return;
    }

    // Init audio on first user gesture (satisfies browser autoplay policy)
    AudioManager.getInstance().init();

    errorEl.textContent = 'Connecting...';

    try {
      await backendClient.setApiKey(apiKey);

      // Pre-spawn the first agent so it's already present when the game loads
      errorEl.textContent = 'Summoning first agent...';
      const activePlanets = worldState.locations.filter(l => l.id !== 'blackhole');
      const startLoc = activePlanets[0];
      const firstAgentProfile = await backendClient.spawnAgent({
        existingAgentNames: [],
        startingPlanetId: startLoc.id,
        worldContext: { weather: worldState.weather, activeEvents: worldState.activeEvents },
      });

      this.scene.start('GameScene', { firstAgentProfile, firstAgentPlanetId: startLoc.id });
      this.scene.launch('UIScene');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to set API key';
      errorEl.textContent = msg;
    }
  }
}
