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
  TRACE_AGENT_DECISIONS,
} from '../config';
import { getBuyListing, getSellListings } from '../../../../shared/market';

export interface AgentDecisionTrace {
  agentName: string;
  targetLocationId: string;
  thought: string;
  sold: { goods: string; quantity: number; profit: number } | null;
  bought: { goods: string; quantity: number; cost: number } | null;
}

export interface ManagedAgent {
  state: AgentState;
  sprite: AgentSprite;
  movement: MovementController;
  paused: boolean;
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

      this.agents.push({ state: agentState, sprite, movement, paused: false });
    });
  }

  update(_time: number, delta: number): void {
    const now = Date.now();
    for (const managed of this.agents) {
      // Advance orbital motion every frame (skip while traveling or paused)
      managed.sprite.updateOrbit(delta);

      if (managed.paused) continue;

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

  private async triggerDecision(managed: ManagedAgent, atPlanet = false): Promise<void> {
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
          playerBudget: worldState.playerBudget,
        },
        // All other agents are visible from space
        nearbyAgents: worldState.agents
          .filter((a) => a.id !== state.id)
          .map(({ id, name, mood, currentGoal }) => ({ id, name, mood, currentGoal })),
      };

      const decision = await backendClient.agentThink(request);

      // Execute trades when the agent just arrived at a planet
      const soldRecord = atPlanet ? this.executeSell(managed, state.currentPlanetId) : null;
      const boughtItem = atPlanet ? this.executeBuy(managed, state.currentPlanetId, decision.purchase) : null;

      // Apply state changes
      state.mood = decision.newMood;
      state.currentGoal = decision.newGoal;
      state.currentThought = decision.thought;
      state.targetLocationId = decision.targetLocationId;

      // Update visuals
      sprite.updateMoodColor(state.mood);
      sprite.showThoughtBubble(decision.thought, state.inventory?.isIllegal ?? false);
      this.scene.events.emit('AGENT_UPDATED', state);

      // Emit decision trace for the GM log
      if (TRACE_AGENT_DECISIONS) {
        const trace: AgentDecisionTrace = {
          agentName: state.name,
          targetLocationId: decision.targetLocationId,
          thought: decision.thought,
          sold: soldRecord,
          bought: boughtItem,
        };
        this.scene.events.emit('AGENT_DECISION', trace);
      }

      // Travel to target planet
      const targetPos = this.map.getPlanetPixelPos(decision.targetLocationId);
      const targetRadius = this.map.getPlanetRadius(decision.targetLocationId);

      movement.travelTo(sprite, targetPos.x, targetPos.y, targetRadius, () => {
        state.currentPlanetId = decision.targetLocationId;
        state.position = {
          tileX: Math.round(targetPos.x / 32),
          tileY: Math.round(targetPos.y / 32),
        };
        state.lastDecisionAt = Date.now() - AGENT_DECISION_INTERVAL_MS; // decide soon after landing
      });
    } catch (err) {
      console.warn(`[AgentManager] Decision failed for ${state.name}:`, err);
      state.lastDecisionAt = Date.now();
    } finally {
      state.pendingDecision = false;
    }
  }

  /** Sell current inventory if the current planet buys it. */
  private executeSell(managed: ManagedAgent, planetId: string): AgentDecisionTrace['sold'] {
    const { state } = managed;
    if (!state.inventory) return null;

    const listing = getBuyListing(planetId, state.inventory.name);
    if (!listing) return null;

    const revenue = listing.price * state.inventory.quantity;
    const cost = state.inventory.buyPrice * state.inventory.quantity;
    const profit = revenue - cost;

    state.cash += revenue;
    const result = { goods: state.inventory.name, quantity: state.inventory.quantity, profit };
    state.inventory = null;
    return result;
  }

  /** Buy goods per Claude's decision. */
  private executeBuy(
    managed: ManagedAgent,
    planetId: string,
    purchase: { itemName: string; quantity: number } | null,
  ): AgentDecisionTrace['bought'] {
    const { state } = managed;
    if (!purchase || purchase.itemName === 'none') return null;
    if (state.inventory) return null;

    const listing = getSellListings(planetId).find(l => l.itemName === purchase.itemName);
    if (!listing) return null;

    const qty = Math.min(Math.max(1, purchase.quantity), 5);
    const totalCost = listing.price * qty;
    if (state.cash < totalCost) return null;

    state.cash -= totalCost;
    state.inventory = {
      name: listing.itemName,
      quantity: qty,
      isIllegal: listing.isIllegal,
      buyPrice: listing.price,
    };

    return { goods: listing.itemName, quantity: qty, cost: totalCost };
  }

  // ─── Player interaction API ───────────────────────────────────────────────

  /** Returns true if the agent is currently orbiting a planet (not traveling). */
  isAgentOrbitingPlanet(agentId: string, planetId?: string): boolean {
    const m = this.agents.find(a => a.state.id === agentId);
    if (!m) return false;
    if (m.movement.isMoving()) return false;
    if (planetId !== undefined && m.state.currentPlanetId !== planetId) return false;
    return true;
  }

  pauseAgent(agentId: string): void {
    const m = this.agents.find(a => a.state.id === agentId);
    if (m) { m.paused = true; m.movement.stop(); }
  }

  resumeAgent(agentId: string): void {
    const m = this.agents.find(a => a.state.id === agentId);
    if (m) {
      m.paused = false;
      m.state.lastDecisionAt = Date.now() - AGENT_DECISION_INTERVAL_MS;
    }
  }

  retriggerAgent(agentId: string): void {
    const m = this.agents.find(a => a.state.id === agentId);
    if (!m) return;
    m.paused = false;
    m.movement.stop();
    m.state.pendingDecision = false;
    m.state.lastDecisionAt = 0;
  }

  getAgents(): ManagedAgent[] {
    return this.agents;
  }
}
