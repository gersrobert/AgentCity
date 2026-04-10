import Phaser from 'phaser';
import InspectorPanel from '../ui/InspectorPanel';
import ChatPanel from '../ui/ChatPanel';
import type { AgentState } from '@shared/types';
import { GAME_WIDTH, GAME_HEIGHT, RIGHT_PANEL_WIDTH } from '../config';

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

  <!-- Inspector section (hidden until agent clicked) -->
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
    <div style="font-size:10px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Goal</div>
    <div id="inspector-goal" style="font-size:10px; color:#cccccc; margin-bottom:10px;"></div>
    <div style="font-size:10px; color:#8888cc; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Thinking</div>
    <div id="inspector-thought" style="font-size:10px; color:#ffffcc; font-style:italic; line-height:1.4;"></div>
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
          placeholder="Command the city..."
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
  private selectedAgentId: string | null = null;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // Create the right panel as a DOM element anchored at the right edge
    const panelDom = this.add.dom(
      GAME_WIDTH - RIGHT_PANEL_WIDTH / 2,
      GAME_HEIGHT / 2
    ).createFromHTML(RIGHT_PANEL_HTML);

    const container = panelDom.node as HTMLElement;

    this.inspectorPanel = new InspectorPanel(container, () => {
      this.selectedAgentId = null;
    });
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

    this.input.keyboard!.on('keydown-ESC', () => {
      this.inspectorPanel.hide();
      this.selectedAgentId = null;
    });

    // Relay world events from ChatPanel back to GameScene
    this.events.on('WORLD_EVENT', (event: unknown) => {
      gameScene.events.emit('WORLD_EVENT', event);
    });
  }
}
