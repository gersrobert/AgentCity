import Phaser from 'phaser';
import InspectorPanel from '../ui/InspectorPanel';
import ChatPanel from '../ui/ChatPanel';
import MinigameOverlay from '../ui/MinigameOverlay';
import type { AgentState } from '@shared/types';
import { GAME_WIDTH, GAME_HEIGHT, RIGHT_PANEL_WIDTH } from '../config';
import { worldState, isGameOver } from '../store/worldState';
import type { AgentDecisionTrace } from '../agents/AgentManager';

const RIGHT_PANEL_HTML = `
<div id="right-panel" style="
  width: ${RIGHT_PANEL_WIDTH}px;
  height: ${GAME_HEIGHT}px;
  background: #12122a;
  border-left: 2px solid #6644aa;
  display: flex;
  flex-direction: column;
  font-family: monospace;
  color: #ffffff;
  overflow: hidden;
">

  <!-- Title bar -->
  <div style="
    padding: 10px 14px;
    background: #1a1a3e;
    border-bottom: 1px solid #6644aa;
    font-size: 15px;
    font-weight: bold;
    color: #ffdd44;
    letter-spacing: 1px;
    flex-shrink: 0;
  ">AgentCity</div>

  <!-- Blackhole Growth Bar -->
  <div id="blackhole-bar" style="
    padding: 8px 14px;
    background: #1a1a3e;
    border-bottom: 1px solid #6644aa;
    flex-shrink: 0;
  ">
    <div style="font-size:9px; color:#ff6644; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Blackhole Growth</div>
    <div style="display:flex; align-items:center; gap:8px;">
      <div id="blackhole-pct" style="font-size:14px; color:#ff4422; font-weight:bold; min-width:40px;">0%</div>
      <div style="flex:1; height:6px; background:#333355; border-radius:3px; overflow:hidden;">
        <div id="blackhole-fill" style="height:100%; width:0%; background:#880022; border-radius:3px; transition: width 0.4s, background 0.4s;"></div>
      </div>
    </div>
    <div style="font-size:8px; color:#555588; margin-top:4px;">← → cycle planets · E inspect agent</div>
  </div>

  <!-- Inspector section (hidden until agent selected) -->
  <div id="inspector-section" style="
    display: none;
    flex-direction: column;
    padding: 12px 14px;
    border-bottom: 2px solid #6644aa;
    background: #1a1a3e;
    flex-shrink: 0;
  ">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <span id="inspector-name" style="font-size:15px; color:#ffdd44; font-weight:bold;"></span>
      <button id="inspector-close" style="
        background: none;
        border: 1px solid #6644aa;
        color: #aaaaaa;
        border-radius: 4px;
        padding: 2px 8px;
        cursor: pointer;
        font-size: 11px;
      ">✕</button>
    </div>
    <div id="inspector-mood" style="font-size:12px; color:#aaffaa; margin-bottom:10px;"></div>
    <div style="font-size:10px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Personality</div>
    <div id="inspector-personality" style="font-size:10px; color:#cccccc; margin-bottom:10px; line-height:1.4;"></div>
    <div style="font-size:10px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Mission</div>
    <div id="inspector-mission" style="font-size:10px; color:#88ddff; margin-bottom:10px; font-style:italic;"></div>
    <div style="font-size:10px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Thinking</div>
    <div id="inspector-thought" style="font-size:10px; color:#ffffcc; font-style:italic; line-height:1.4; margin-bottom:10px;"></div>
    <div style="font-size:10px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Cargo</div>
    <div id="inspector-cargo" style="font-size:11px; color:#cccccc; margin-bottom:4px; line-height:1.4;"></div>
    <div style="font-size:10px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Credits</div>
    <div id="inspector-cash" style="font-size:12px; color:#ffdd44; margin-bottom:10px;"></div>
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
      <div id="inspector-result-text" style="font-size:10px; color:#ffffcc; line-height:1.5;"></div>
    </div>
  </div>

  <!-- Chat section -->
  <div style="
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 12px 14px;
    overflow: hidden;
    min-height: 0;
  ">
    <div style="font-size:11px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; flex-shrink:0;">Game Master</div>

    <!-- Chat log -->
    <div id="chat-log" style="
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      padding-right: 4px;
      scrollbar-width: thin;
      scrollbar-color: #6644aa #12122a;
    "></div>

    <!-- Input area -->
    <div style="flex-shrink:0; margin-top:10px;">
      <div style="display:flex; gap:6px; margin-bottom:6px;">
        <input
          id="gm-input"
          type="text"
          placeholder="Command the universe..."
          style="
            flex: 1;
            background: #0d0d20;
            color: #ffffff;
            border: 1px solid #6644aa;
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 11px;
            font-family: monospace;
            outline: none;
            min-width: 0;
          "
        />
        <button id="gm-send" style="
          background: #6644aa;
          color: #fff;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 11px;
          cursor: pointer;
          white-space: nowrap;
        ">Send</button>
      </div>
      <div id="gm-status" style="font-size:9px; color:#ffaa44; min-height:14px;"></div>
    </div>
  </div>
</div>
`;

export default class UIScene extends Phaser.Scene {
  private inspectorPanel!: InspectorPanel;
  private chatPanel!: ChatPanel;
  private minigame!: MinigameOverlay;
  private selectedAgentId: string | null = null;
  private blackholePctEl!: HTMLElement;
  private blackholeFillEl!: HTMLElement;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    const panelDom = this.add.dom(
      GAME_WIDTH - RIGHT_PANEL_WIDTH / 2,
      GAME_HEIGHT / 2,
    ).createFromHTML(RIGHT_PANEL_HTML);

    const container = panelDom.node as HTMLElement;

    this.blackholePctEl = container.querySelector('#blackhole-pct') as HTMLElement;
    this.blackholeFillEl = container.querySelector('#blackhole-fill') as HTMLElement;

    this.inspectorPanel = new InspectorPanel(
      container,
      () => { this.handleDismiss(this.selectedAgentId!); },
      (agentId: string) => { this.handleThoroughInspect(agentId); },
      (agentId: string) => { this.handleDismiss(agentId); },
    );

    this.minigame = new MinigameOverlay();
    this.chatPanel = new ChatPanel(this, container);

    const gameScene = this.scene.get('GameScene');

    gameScene.events.on('AGENT_SELECTED', (agent: AgentState) => {
      this.selectedAgentId = agent.id;
      this.inspectorPanel.show(agent);
    });

    gameScene.events.on('AGENT_UPDATED', (agent: AgentState) => {
      if (this.selectedAgentId === agent.id) {
        this.inspectorPanel.update(agent);
      }
    });

    gameScene.events.on('AGENT_DECISION', (trace: AgentDecisionTrace) => {
      this.chatPanel.logAgentDecision(trace);
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

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.selectedAgentId) {
        this.handleDismiss(this.selectedAgentId);
      }
    });

    // Relay world events from ChatPanel back to GameScene
    this.events.on('WORLD_EVENT', (event: unknown) => {
      gameScene.events.emit('WORLD_EVENT', event);
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
      <div style="font-size:32px; color:#ff2200; margin-bottom:16px;">THE VOID HAS WON</div>
      <div style="font-size:14px; color:#aaaaaa; margin-bottom:24px;">The blackhole has consumed everything.</div>
      <button onclick="location.reload()" style="
        background:#6644aa; color:#fff; border:none;
        border-radius:6px; padding:10px 24px; font-size:14px;
        cursor:pointer; font-family:monospace;
      ">Try Again</button>
    `;
    document.body.appendChild(overlay);
    this.scene.pause('GameScene');
  }
}
