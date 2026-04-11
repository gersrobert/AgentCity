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
  TRADE_HISTORY_MAX_LENGTH,
  SUSPICION_INCREASE_PER_TRADE,
  SUSPICION_DECREASE_PER_TRADE,
} from '../config';
import { getBuyListing, getSellListings } from '../../../shared/market';

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

      const managed: ManagedAgent = { state: agentState, sprite, movement };
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
          playerBudget: worldState.playerBudget,
        },
        nearbyAgents,
      };

      const decision = await backendClient.agentThink(request);

      // Sell current inventory at this location (if it buys the item), then buy
      const currentLocation = state.targetLocationId;
      this.executeSell(managed, currentLocation);
      this.executeBuy(managed, currentLocation, decision.purchase);

      // Apply decision to state
      state.mood = decision.newMood;
      state.currentGoal = decision.newGoal;
      state.currentThought = decision.thought;
      state.targetLocationId = decision.targetLocationId;

      // Update visuals
      sprite.updateMoodColor(state.mood);
      sprite.showThoughtBubble(decision.thought, state.inventory?.isIllegal ?? false);
      sprite.updateSuspicionIndicator(state.suspicionLevel);

      // Update inspector if this agent is selected
      this.scene.events.emit('AGENT_UPDATED', state);

      // Move to target; trigger next decision immediately on arrival
      const location = this.map.getLocation(decision.targetLocationId);
      if (location) {
        const fromTile = this.map.worldToTile(sprite.x, sprite.y);
        movement.walkTo(sprite, fromTile, location.tile, () => {
          state.position = location.tile;
          this.triggerDecision(managed);
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

  /**
   * Sell current inventory at this location — only if the location buys that item.
   * If the location doesn't buy it, the agent keeps their goods and moves on.
   */
  private executeSell(managed: ManagedAgent, locationId: string | null): void {
    const { state } = managed;
    if (!state.inventory || !locationId) return;

    const listing = getBuyListing(locationId, state.inventory.name);
    if (!listing) return; // this location doesn't buy what we're carrying

    const revenue = listing.price * state.inventory.quantity;
    const cost = state.inventory.buyPrice * state.inventory.quantity;
    const profit = revenue - cost;

    state.tradeHistory.push({
      locationId,
      goods: state.inventory.name,
      quantity: state.inventory.quantity,
      profit,
      isIllegal: state.inventory.isIllegal,
      timestamp: Date.now(),
    });
    if (state.tradeHistory.length > TRADE_HISTORY_MAX_LENGTH) {
      state.tradeHistory.shift();
    }

    state.cash += revenue;
    state.inventory = null;

    if (listing.isIllegal) {
      state.suspicionLevel = Math.min(100, state.suspicionLevel + SUSPICION_INCREASE_PER_TRADE);
    } else {
      state.suspicionLevel = Math.max(0, state.suspicionLevel - SUSPICION_DECREASE_PER_TRADE);
    }
  }

  /**
   * Buy goods based on Claude's purchase decision.
   * Only executes if the agent has empty hands and the item is actually sold here.
   */
  private executeBuy(managed: ManagedAgent, locationId: string | null, purchase: { itemName: string; quantity: number } | null): void {
    const { state } = managed;
    if (!purchase || purchase.itemName === 'none' || !locationId) return;
    if (state.inventory) return; // already carrying something

    const listing = getSellListings(locationId).find(l => l.itemName === purchase.itemName);
    if (!listing) return; // item not sold here

    const qty = Math.min(Math.max(1, purchase.quantity), 5);
    const totalCost = listing.price * qty;
    if (state.cash < totalCost) return;

    state.cash -= totalCost;
    state.inventory = {
      name: listing.itemName,
      quantity: qty,
      isIllegal: listing.isIllegal,
      buyPrice: listing.price,
    };
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
