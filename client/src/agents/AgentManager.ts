import Phaser from 'phaser';
import type { AgentState, AgentThinkRequest } from '@shared/types';
import { worldState } from '../store/worldState';
import AgentSprite from './AgentSprite';
import MovementController from './MovementController';
import CityMap from '../map/CityMap';
import * as backendClient from '../api/backendClient';
import {
  AGENT_DECISION_INTERVAL_MS,
  AGENT_DECISION_STAGGER_MS,
} from '../config';

export interface ManagedAgent {
  state: AgentState;
  sprite: AgentSprite;
  movement: MovementController;
}

export default class AgentManager {
  private scene: Phaser.Scene;
  private map: CityMap;
  private agents: ManagedAgent[] = [];

  constructor(scene: Phaser.Scene, map: CityMap) {
    this.scene = scene;
    this.map = map;
  }

  init(): void {
    worldState.agents.forEach((agentState, i) => {
      const pos = this.map.getPlanetPixelPos(agentState.currentPlanetId);
      const radius = this.map.getPlanetRadius(agentState.currentPlanetId);

      const sprite = new AgentSprite(this.scene, agentState, pos.x, pos.y, radius, i);
      const movement = new MovementController(this.scene);

      sprite.getGraphics().on('pointerdown', () => {
        this.scene.events.emit('AGENT_SELECTED', agentState);
      });
      sprite.getGraphics().on('pointerover', () => {
        this.scene.input.setDefaultCursor('pointer');
      });
      sprite.getGraphics().on('pointerout', () => {
        this.scene.input.setDefaultCursor('default');
      });

      // Stagger initial decisions
      agentState.lastDecisionAt = Date.now() - i * AGENT_DECISION_STAGGER_MS;

      this.agents.push({ state: agentState, sprite, movement });
    });
  }

  update(_time: number, delta: number): void {
    const now = Date.now();
    for (const managed of this.agents) {
      // Advance orbital motion every frame
      managed.sprite.updateOrbit(delta);

      const { state } = managed;
      const timeSinceDecision = now - state.lastDecisionAt;

      if (
        !state.pendingDecision &&
        !managed.movement.isMoving() &&
        timeSinceDecision > AGENT_DECISION_INTERVAL_MS
      ) {
        this.triggerDecision(managed);
      }
    }
  }

  private async triggerDecision(managed: ManagedAgent): Promise<void> {
    const { state, sprite, movement } = managed;
    state.pendingDecision = true;
    state.lastDecisionAt = Date.now();

    try {
      const request: AgentThinkRequest = {
        agent: state,
        worldState: {
          locations: worldState.locations,
          weather: worldState.weather,
          timeOfDay: worldState.timeOfDay,
          activeEvents: worldState.activeEvents,
        },
        // All other agents are visible from space
        nearbyAgents: worldState.agents
          .filter((a) => a.id !== state.id)
          .map(({ id, name, mood, currentGoal }) => ({ id, name, mood, currentGoal })),
      };

      const decision = await backendClient.agentThink(request);

      // Apply state changes
      state.mood = decision.newMood;
      state.currentGoal = decision.newGoal;
      state.currentThought = decision.thought;
      state.targetLocationId = decision.targetLocationId;

      // Update visuals
      sprite.updateMoodColor(state.mood);
      sprite.showThoughtBubble(decision.thought);
      this.scene.events.emit('AGENT_UPDATED', state);

      // Travel to target planet
      const targetPos = this.map.getPlanetPixelPos(decision.targetLocationId);
      const targetRadius = this.map.getPlanetRadius(decision.targetLocationId);

      movement.travelTo(sprite, targetPos.x, targetPos.y, targetRadius, () => {
        state.currentPlanetId = decision.targetLocationId;
        state.position = {
          tileX: Math.round(targetPos.x / 32),
          tileY: Math.round(targetPos.y / 32),
        };
        state.lastDecisionAt = Date.now();
      });
    } catch (err) {
      console.warn(`[AgentManager] Decision failed for ${state.name}:`, err);
      state.lastDecisionAt = Date.now();
    } finally {
      state.pendingDecision = false;
    }
  }

  getAgents(): ManagedAgent[] {
    return this.agents;
  }
}
