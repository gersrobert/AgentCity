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
  NEARBY_AGENT_TILE_RADIUS,
} from '../config';

interface ManagedAgent {
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
      const sprite = new AgentSprite(this.scene, agentState, i);
      const movement = new MovementController(this.scene, this.map);

      // Make sprite clickable
      sprite.getCircle().on('pointerdown', () => {
        this.scene.events.emit('AGENT_SELECTED', agentState);
      });
      sprite.getCircle().on('pointerover', () => {
        this.scene.input.setDefaultCursor('pointer');
      });
      sprite.getCircle().on('pointerout', () => {
        this.scene.input.setDefaultCursor('default');
      });

      // Stagger initial decisions so they don't all fire at once
      agentState.lastDecisionAt = Date.now() - (i * AGENT_DECISION_STAGGER_MS);

      this.agents.push({ state: agentState, sprite, movement });
    });
  }

  update(_time: number, _delta: number): void {
    const now = Date.now();
    for (const managed of this.agents) {
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
      const nearbyAgents = this.getNearbyAgents(state);
      const request: AgentThinkRequest = {
        agent: state,
        worldState: {
          locations: worldState.locations,
          weather: worldState.weather,
          timeOfDay: worldState.timeOfDay,
          activeEvents: worldState.activeEvents,
        },
        nearbyAgents,
      };

      const decision = await backendClient.agentThink(request);

      // Apply decision to state
      state.mood = decision.newMood;
      state.currentGoal = decision.newGoal;
      state.currentThought = decision.thought;
      state.targetLocationId = decision.targetLocationId;

      // Update visuals
      sprite.updateMoodColor(state.mood);
      sprite.showThoughtBubble(decision.thought);

      // Update inspector if this agent is selected
      this.scene.events.emit('AGENT_UPDATED', state);

      // Move to target
      const location = this.map.getLocation(decision.targetLocationId);
      if (location) {
        const fromTile = this.map.worldToTile(sprite.x, sprite.y);
        movement.walkTo(sprite, fromTile, location.tile, () => {
          state.position = location.tile;
          state.lastDecisionAt = Date.now();
        });
      }
    } catch (err) {
      console.warn(`[AgentManager] Decision failed for ${state.name}:`, err);
      // Reset lastDecisionAt so the agent retries after the normal interval
      state.lastDecisionAt = Date.now();
    } finally {
      state.pendingDecision = false;
    }
  }

  private getNearbyAgents(
    agent: AgentState
  ): Pick<AgentState, 'id' | 'name' | 'mood' | 'currentGoal'>[] {
    return worldState.agents
      .filter((other) => {
        if (other.id === agent.id) return false;
        const dx = Math.abs(other.position.tileX - agent.position.tileX);
        const dy = Math.abs(other.position.tileY - agent.position.tileY);
        return dx + dy <= NEARBY_AGENT_TILE_RADIUS;
      })
      .map(({ id, name, mood, currentGoal }) => ({ id, name, mood, currentGoal }));
  }

  getAgents(): ManagedAgent[] {
    return this.agents;
  }
}
