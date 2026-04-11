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
  TRACE_AGENT_DECISIONS,
} from '../config';

export interface AgentDecisionTrace {
  agentName: string;
  targetLocationId: string;
  thought: string;
  sold: { goods: string; quantity: number; profit: number } | null;
  bought: { goods: string; quantity: number; cost: number } | null;
}
import { getBuyListing, getSellListings } from '../../../shared/market';


interface ManagedAgent {
  state: AgentState;
  sprite: AgentSprite;
  movement: MovementController;
  isAtLocation: boolean;
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

      const managed: ManagedAgent = { state: agentState, sprite, movement, isAtLocation: true };
      this.agents.push(managed);

      // Stagger first decision so agents don't all call the API simultaneously
      this.scene.time.delayedCall(i * AGENT_DECISION_STAGGER_MS, () => {
        this.triggerDecision(managed);
      });
    });
  }

  update(_time: number, _delta: number): void {
    // Decision timing is now driven by arrival, not a fixed interval.
    // Nothing to poll here.
  }

  private async triggerDecision(managed: ManagedAgent, atLocation = false): Promise<void> {
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
          playerBudget: worldState.playerBudget,
        },
        nearbyAgents,
      };

      const decision = await backendClient.agentThink(request);

      // Only sell/buy when the agent physically arrived at a location
      const currentLocation = state.targetLocationId;
      const soldRecord = atLocation ? this.executeSell(managed, currentLocation) : null;
      const boughtItem = atLocation ? this.executeBuy(managed, currentLocation, decision.purchase) : null;

      // Apply decision to state
      state.mood = decision.newMood;
      state.currentGoal = decision.newGoal;
      state.currentThought = decision.thought;
      state.targetLocationId = decision.targetLocationId;

      // Update visuals
      sprite.updateMoodColor(state.mood);
      sprite.showThoughtBubble(decision.thought, state.inventory?.isIllegal ?? false);

      // Update inspector if this agent is selected
      this.scene.events.emit('AGENT_UPDATED', state);

      // Trace log
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

      // Move to target; trigger next decision immediately on arrival
      const location = this.map.getLocation(decision.targetLocationId);
      if (location) {
        const fromTile = this.map.worldToTile(sprite.x, sprite.y);
        managed.isAtLocation = false;
        movement.walkTo(sprite, fromTile, location.tile, () => {
          managed.isAtLocation = true;
          state.position = location.tile;
          this.triggerDecision(managed, true);
        });
      } else {
        // Unknown location — retry after a short delay
        this.scene.time.delayedCall(AGENT_DECISION_INTERVAL_MS, () => {
          this.triggerDecision(managed);
        });
      }
    } catch (err) {
      console.warn(`[AgentManager] Decision failed for ${state.name}:`, err);
      // Retry after the normal interval on API error
      this.scene.time.delayedCall(AGENT_DECISION_INTERVAL_MS, () => {
        this.triggerDecision(managed);
      });
    } finally {
      state.pendingDecision = false;
    }
  }

  /** Sell current inventory if this location buys it. Returns sale info or null. */
  private executeSell(managed: ManagedAgent, locationId: string | null): AgentDecisionTrace['sold'] {
    const { state } = managed;
    if (!state.inventory || !locationId) return null;

    const listing = getBuyListing(locationId, state.inventory.name);
    if (!listing) return null;

    const revenue = listing.price * state.inventory.quantity;
    const cost = state.inventory.buyPrice * state.inventory.quantity;
    const profit = revenue - cost;

    const result = { goods: state.inventory.name, quantity: state.inventory.quantity, profit };
    state.cash += revenue;
    state.inventory = null;

    return result;
  }

  /** Buy goods from Claude's decision. Returns purchase info or null. */
  private executeBuy(managed: ManagedAgent, locationId: string | null, purchase: { itemName: string; quantity: number } | null): AgentDecisionTrace['bought'] {
    const { state } = managed;
    if (!purchase || purchase.itemName === 'none' || !locationId) return null;
    if (state.inventory) return null;

    const listing = getSellListings(locationId).find(l => l.itemName === purchase.itemName);
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

  isAgentInterceptable(agentId: string): boolean {
    const m = this.agents.find(a => a.state.id === agentId);
    return m !== undefined && !m.isAtLocation && !m.movement.isPaused();
  }

  getAgentLiveTile(agentId: string): { tileX: number; tileY: number } | null {
    const m = this.agents.find(a => a.state.id === agentId);
    if (!m) return null;
    return this.map.worldToTile(m.sprite.x, m.sprite.y);
  }

  pauseAgent(agentId: string): void {
    const m = this.agents.find(a => a.state.id === agentId);
    if (m) m.movement.pause();
  }

  resumeAgent(agentId: string): void {
    const m = this.agents.find(a => a.state.id === agentId);
    if (m) m.movement.resume();
  }

  retriggerAgent(agentId: string): void {
    const m = this.agents.find(a => a.state.id === agentId);
    if (!m) return;
    m.movement.stop();
    m.isAtLocation = false;
    m.state.targetLocationId = null;
    this.triggerDecision(m);
  }

  getAgents(): ManagedAgent[] {
    return this.agents;
  }
}
