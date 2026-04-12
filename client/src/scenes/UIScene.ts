import Phaser from 'phaser';
import InspectorPanel from '../ui/InspectorPanel';
import MinigameOverlay from '../ui/MinigameOverlay';
import PlanetInfoPanel from '../ui/PlanetInfoPanel';
import type { AgentState } from '@shared/types';
import type { PlanetData } from '../map/mapData';
import { worldState, isGameOver } from '../store/worldState';

const HUD_HTML = `
<div id="hud-bar" style="
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(18,18,42,0.85);
  border: 1px solid #6644aa;
  border-radius: 8px;
  padding: 8px 18px;
  display: flex;
  align-items: center;
  gap: 18px;
  font-family: monospace;
  color: #ffffff;
  z-index: 1000;
  backdrop-filter: blur(4px);
  pointer-events: none;
">
  <div style="display:flex; align-items:center; gap:6px;">
    <div style="font-size:9px; color:#ff6644; text-transform:uppercase; letter-spacing:1px;">NIC</div>
    <div id="blackhole-pct" style="font-size:13px; color:#ff4422; font-weight:bold; min-width:36px;">0%</div>
    <div style="width:100px; height:5px; background:#333355; border-radius:3px; overflow:hidden;">
      <div id="blackhole-fill" style="height:100%; width:0%; background:#880022; border-radius:3px; transition: width 0.4s, background 0.4s;"></div>
    </div>
  </div>
  <div style="width:1px; height:18px; background:#6644aa44;"></div>
  <div style="display:flex; align-items:center; gap:5px;">
    <div style="font-size:9px; color:#446688; text-transform:uppercase; letter-spacing:1px;">Survive</div>
    <div id="survival-timer" style="font-size:13px; color:#6699bb; font-weight:bold; font-family:monospace; min-width:38px;">10:00</div>
  </div>
</div>

<!-- Planet info popup (hidden until planet clicked) -->
<div id="planet-section" style="
  display: none;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
  max-height: 70vh;
  background: #12122a;
  border: 2px solid #6644aa;
  border-radius: 10px;
  padding: 14px;
  font-family: monospace;
  color: #ffffff;
  z-index: 1100;
  overflow-y: auto;
  box-shadow: 0 0 30px rgba(102,68,170,0.4);
">
  <div id="planet-section-content"></div>
</div>

<!-- Inspector popup (hidden until agent selected) -->
<div id="inspector-section" style="
  display: none;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
  max-height: 80vh;
  background: #12122a;
  border: 2px solid #6644aa;
  border-radius: 10px;
  font-family: monospace;
  color: #ffffff;
  z-index: 1100;
  box-shadow: 0 0 30px rgba(102,68,170,0.4);
  flex-direction: column;
  overflow: hidden;
">
  <!-- Sticky header -->
  <div style="
    display:flex; justify-content:space-between; align-items:center;
    padding: 12px 14px 8px;
    border-bottom: 1px solid #6644aa44;
    flex-shrink: 0;
  ">
    <span id="inspector-name" style="font-size:15px; color:#ffdd44; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px;"></span>
    <button id="inspector-close" style="
      background: none;
      border: 1px solid #6644aa;
      color: #aaaaaa;
      border-radius: 4px;
      padding: 2px 8px;
      cursor: pointer;
      font-size: 11px;
      flex-shrink: 0;
    ">✕</button>
  </div>
  <!-- Scrollable body -->
  <div style="overflow-y: auto; padding: 10px 14px 14px; flex: 1; min-height: 0;">
    <div id="inspector-mood" style="font-size:12px; color:#aaffaa; margin-bottom:10px;"></div>
    <div style="font-size:10px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Personality</div>
    <div id="inspector-personality" style="font-size:10px; color:#cccccc; margin-bottom:10px; line-height:1.4; word-break:break-word;"></div>
    <div style="font-size:10px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Mission</div>
    <div id="inspector-mission" style="font-size:10px; color:#88ddff; margin-bottom:10px; font-style:italic; word-break:break-word;"></div>
    <div style="font-size:10px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Thinking</div>
    <div id="inspector-thought" style="font-size:10px; color:#ffffcc; font-style:italic; line-height:1.4; margin-bottom:10px; word-break:break-word;"></div>
    <div style="font-size:10px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Cargo</div>
    <div id="inspector-cargo" style="font-size:11px; color:#cccccc; margin-bottom:8px; line-height:1.4;"></div>
    <div style="font-size:10px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Credits</div>
    <div id="inspector-cash" style="font-size:12px; color:#ffdd44; margin-bottom:12px;"></div>
    <div style="display:flex; gap:6px; margin-bottom:10px;">
      <button id="inspector-dismiss-btn" style="
        flex: 1;
        background: #333333;
        color: #aaaaaa;
        border: 1px solid #555566;
        border-radius: 4px;
        padding: 5px 8px;
        font-size: 10px;
        cursor: pointer;
        font-family: monospace;
      ">✕ Dismiss</button>
      <button id="inspector-thorough-btn" style="
        flex: 1;
        background: #333388;
        color: #ffffff;
        border: 1px solid #6644aa;
        border-radius: 4px;
        padding: 5px 8px;
        font-size: 10px;
        cursor: pointer;
        font-family: monospace;
      ">Thorough Inspect</button>
    </div>
    <div id="inspector-result" style="display:none; margin-bottom:8px;">
      <div id="inspector-result-text" style="font-size:10px; color:#ffffcc; line-height:1.5; word-break:break-word;"></div>
    </div>
  </div>
</div>
`;

export default class UIScene extends Phaser.Scene {
  private inspectorPanel!: InspectorPanel;
  private minigame!: MinigameOverlay;
  private planetInfoPanel!: PlanetInfoPanel;
  private selectedAgentId: string | null = null;
  private blackholePctEl!: HTMLElement;
  private blackholeFillEl!: HTMLElement;
  private survivalTimerEl!: HTMLElement;
  private hudEl!: HTMLElement;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // Inject HUD + popup HTML directly into document body
    const wrapper = document.createElement('div');
    wrapper.innerHTML = HUD_HTML;
    document.body.appendChild(wrapper);

    this.hudEl = wrapper;

    this.blackholePctEl  = document.querySelector('#blackhole-pct')    as HTMLElement;
    this.blackholeFillEl = document.querySelector('#blackhole-fill')   as HTMLElement;
    this.survivalTimerEl = document.querySelector('#survival-timer')   as HTMLElement;

    this.inspectorPanel = new InspectorPanel(
      document.body,
      () => { this.handleDismiss(this.selectedAgentId!); },
      (agentId: string) => { this.handleThoroughInspect(agentId); },
      (agentId: string) => { this.handleDismiss(agentId); },
    );

    this.minigame = new MinigameOverlay();
    this.planetInfoPanel = new PlanetInfoPanel(document.body);

    const gameScene = this.scene.get('GameScene');

    gameScene.events.on('AGENT_SELECTED', (agent: AgentState) => {
      this.selectedAgentId = agent.id;
      this.planetInfoPanel.hide();
      this.inspectorPanel.show(agent);
    });

    gameScene.events.on('AGENT_UPDATED', (agent: AgentState) => {
      if (this.selectedAgentId === agent.id) {
        this.inspectorPanel.update(agent);
      }
    });

    // Fired by AgentManager when player drifts out of range or a new agent is opened
    gameScene.events.on('INSPECTION_CLOSED', () => {
      this.inspectorPanel.hide();
      this.selectedAgentId = null;
    });

    this.events.on('BLACKHOLE_GROW', (sizeFraction: number) => {
      this.updateBlackholeBar(sizeFraction);
      if (isGameOver()) {
        this.triggerGameOver();
      }
    });

    this.events.on('TIMER_TICK', (remaining: number) => {
      this.updateSurvivalTimer(remaining);
    });

    this.events.on('PLAYER_WIN', () => {
      this.triggerVictory();
    });

    // Controls hint — fades in briefly then disappears
    this.time.delayedCall(500, () => this.showControlsHint());

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.selectedAgentId) {
        this.handleDismiss(this.selectedAgentId);
      }
    });

    gameScene.events.on('PLANET_CLICKED', (planet: PlanetData) => {
      this.inspectorPanel.hide();
      this.selectedAgentId = null;
      this.planetInfoPanel.show(planet);
    });
  }

  private handleDismiss(agentId: string): void {
    const gameScene = this.scene.get('GameScene');
    gameScene.events.emit('AGENT_RESUME', agentId);
    gameScene.events.emit('INSPECTION_DISMISS', agentId);
    this.inspectorPanel.hide();
    this.selectedAgentId = null;
  }

  private handleThoroughInspect(agentId: string): void {
    const agent = worldState.agents.find(a => a.id === agentId);
    if (!agent) return;

    this.minigame.show((won: boolean) => {
      this.inspectorPanel.showMinigameResult(agent, won);

      if (won && agent.inventory.some(i => i.isIllegal)) {
        // Play explosion immediately, keep panel open so player reads the result
        this.scene.get('GameScene').events.emit('EXPLODE_AGENT', agentId);
      }
    });
  }

  private updateBlackholeBar(sizeFraction: number): void {
    const pct = Math.round(sizeFraction * 100);
    this.blackholePctEl.textContent = pct + '%';
    this.blackholeFillEl.style.width = pct + '%';
    this.blackholeFillEl.style.background = pct < 40 ? '#880022' : pct < 70 ? '#cc2200' : '#ff1100';
  }

  private updateSurvivalTimer(remaining: number): void {
    const totalSeconds = Math.ceil(remaining);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    this.survivalTimerEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;

    // Colour shifts as time runs low
    if (remaining < 60) {
      this.survivalTimerEl.style.color = '#ff6644';
    } else if (remaining < 120) {
      this.survivalTimerEl.style.color = '#ffaa44';
    }
  }

  private triggerVictory(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,4,0.95);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-family: monospace; color: white; z-index: 9999;
    `;
    overlay.innerHTML = `
      <div style="font-size:11px; color:#334466; letter-spacing:4px; margin-bottom:20px; text-transform:uppercase;">System Status: Contained</div>
      <div style="font-size:52px; color:#aaccff; font-weight:bold; letter-spacing:8px; margin-bottom:12px;">NIC RETREATS</div>
      <div style="font-size:14px; color:#556677; margin-bottom:8px; font-style:italic;">For now, the void holds its breath.</div>
      <div style="font-size:11px; color:#334455; margin-bottom:36px;">You survived 10 minutes. The system endures.</div>
      <button onclick="location.reload()" style="
        background: transparent;
        color: #6688aa;
        border: 1px solid #334466;
        border-radius: 4px;
        padding: 10px 36px;
        font-size: 12px;
        cursor: pointer;
        font-family: monospace;
        letter-spacing: 3px;
      ">PLAY AGAIN</button>
    `;
    document.body.appendChild(overlay);
    // Fade in
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 1.2s';
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
  }

  private showControlsHint(): void {
    const { width, height } = this.cameras.main;

    const hint = this.add.text(
      width / 2,
      height * 0.88,
      'W  Thrust    A / D  Rotate    E  Inspect agent',
      {
        fontSize: '11px',
        color: '#445566',
        fontFamily: 'monospace',
        backgroundColor: '#00000066',
        padding: { x: 14, y: 8 },
        letterSpacing: 1,
      },
    ).setOrigin(0.5, 0.5).setDepth(100).setAlpha(0);

    this.tweens.add({ targets: hint, alpha: 1, duration: 800 });
    this.tweens.add({ targets: hint, alpha: 0, duration: 1200, delay: 5000, onComplete: () => hint.destroy() });
  }

  private triggerGameOver(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.92);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-family: monospace; color: white; z-index: 9999;
    `;
    overlay.innerHTML = `
      <div style="font-size:11px; color:#443322; letter-spacing:4px; margin-bottom:20px; text-transform:uppercase;">System Status: Lost</div>
      <div style="font-size:52px; color:#ff3311; font-weight:bold; letter-spacing:8px; margin-bottom:12px;">NIC WINS</div>
      <div style="font-size:14px; color:#554433; margin-bottom:8px; font-style:italic;">"They thought naming it would contain it."</div>
      <div style="font-size:11px; color:#443322; margin-bottom:36px;">The void has removed everything. Even you.</div>
      <button onclick="location.reload()" style="
        background: transparent;
        color: #886655;
        border: 1px solid #443322;
        border-radius: 4px;
        padding: 10px 36px;
        font-size: 12px;
        cursor: pointer;
        font-family: monospace;
        letter-spacing: 3px;
      ">TRY AGAIN</button>
    `;
    document.body.appendChild(overlay);
    this.scene.pause('GameScene');
  }
}
