import Phaser from 'phaser';
import InspectorPanel from '../ui/InspectorPanel';
import ChatPanel from '../ui/ChatPanel';
import type { AgentState } from '@shared/types';

export default class UIScene extends Phaser.Scene {
  private inspectorPanel!: InspectorPanel;
  private chatPanel!: ChatPanel;
  private selectedAgentId: string | null = null;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.inspectorPanel = new InspectorPanel(this);
    this.chatPanel = new ChatPanel(this);

    // Listen to GameScene events
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

    // Click anywhere on the background (outside an agent) hides inspector
    this.input.on('pointerdown', () => {
      // We rely on agent sprites stopping propagation — hide on canvas click
      // Actually Phaser doesn't stop propagation, so we check the GameScene for selection
    });

    // Close inspector on Escape
    this.input.keyboard!.on('keydown-ESC', () => {
      this.inspectorPanel.hide();
      this.selectedAgentId = null;
    });

    // Relay world events from ChatPanel back to GameScene
    this.events.on('WORLD_EVENT', (event: unknown) => {
      this.scene.get('GameScene').events.emit('WORLD_EVENT', event);
    });
  }
}
