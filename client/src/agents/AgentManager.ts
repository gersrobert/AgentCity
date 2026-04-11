import Phaser from 'phaser';
import type { AgentState, AgentThinkRequest } from '@shared/types';
import { worldState, growBlackhole } from '../store/worldState';
import AgentSprite from './AgentSprite';
import MovementController from './MovementController';
import CityMap from '../map/CityMap';
import BlackHole from '../map/BlackHole';
import * as backendClient from '../api/backendClient';
import {
  AGENT_DECISION_INTERVAL_MS,
  AGENT_DECISION_STAGGER_MS,
  TRACE_AGENT_DECISIONS,
  BLACKHOLE_GROWTH_PER_DELIVERY,
} from '../config';
import { getBuyListing, getSellListings, ILLEGAL_CASH_RESERVE } from '@shared/market';

export interface AgentDecisionTrace {
  agentName: string;
  targetLocationId: string;
  thought: string;
  sold: { goods: string; quantity: number; profit: number } | null;
  bought: { goods: string; quantity: number; cost: number } | null;
}

export interface ActiveTrip {
  toX: number;
  toY: number;
  toRadius: number;
  onArrival: () => void;
}

export interface ManagedAgent {
  state: AgentState;
  sprite: AgentSprite;
  movement: MovementController;
  paused: boolean;
  activeTrip: ActiveTrip | null;
}

export default class AgentManager {
  private scene: Phaser.Scene;
  private map: CityMap;
  private agents: ManagedAgent[] = [];
  private blackHole: BlackHole | null = null;

  constructor(scene: Phaser.Scene, map: CityMap) {
    this.scene = scene;
    this.map = map;
  }

  setBlackHole(bh: BlackHole): void {
    this.blackHole = bh;
  }

  init(): void {
    const { width: mapW, height: mapH } = this.map.getMapDimensions();
    worldState.agents.forEach((agentState, i) => {
      const pos = this.map.getPlanetPixelPos(agentState.currentPlanetId);
      const radius = this.map.getPlanetRadius(agentState.currentPlanetId);

      const sprite = new AgentSprite(this.scene, agentState, pos.x, pos.y, radius, i);
      sprite.setBounds(mapW, mapH);
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

      this.agents.push({ state: agentState, sprite, movement, paused: false, activeTrip: null });
    });
  }

  update(_time: number, delta: number): void {
    const now = Date.now();
    for (const managed of this.agents) {
      if (managed.paused) continue;

      // Keep orbit radius in sync with the live blackhole size
      if (
        this.blackHole &&
        managed.state.currentPlanetId === 'blackhole' &&
        !managed.movement.isMoving()
      ) {
        managed.sprite.orbitRadius = this.blackHole.getRadius() + 22;
      }

      // Advance orbital motion every frame (skip while traveling or paused)
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
    // Agent is at their current planet — execute trades
    const atPlanet = true;

    try {
      const request: AgentThinkRequest = {
        agent: state,
        worldState: {
          locations: worldState.locations,
          weather: worldState.weather,
          timeOfDay: worldState.timeOfDay,
          activeEvents: worldState.activeEvents,
          blackholeSize: worldState.blackholeSize,
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
      sprite.showThoughtBubble(decision.thought, state.inventory.some(i => i.isIllegal));
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
      const targetRadius = decision.targetLocationId === 'blackhole' && this.blackHole
        ? this.blackHole.getRadius()
        : this.map.getPlanetRadius(decision.targetLocationId);

      const { width: mapW, height: mapH } = this.map.getMapDimensions();
      // Add the blackhole as an obstacle for inter-planet travel so agents route around it
      const bhObstacle = decision.targetLocationId !== 'blackhole' && this.blackHole
        ? [{ x: mapW / 2, y: mapH / 2, radius: this.blackHole.getRadius() }]
        : [];

      const onArrival = () => {
        state.currentPlanetId = decision.targetLocationId;
        state.position = {
          tileX: Math.round(targetPos.x / 32),
          tileY: Math.round(targetPos.y / 32),
        };
        managed.activeTrip = null;
        state.lastDecisionAt = Date.now() - AGENT_DECISION_INTERVAL_MS; // decide soon after landing
      };
      managed.activeTrip = { toX: targetPos.x, toY: targetPos.y, toRadius: targetRadius, onArrival };
      movement.travelTo(sprite, targetPos.x, targetPos.y, targetRadius, onArrival, this.map.getAllPlanets(), mapW, mapH, bhObstacle);
    } catch (err) {
      console.warn(`[AgentManager] Decision failed for ${state.name}:`, err);
      state.lastDecisionAt = Date.now();
    } finally {
      state.pendingDecision = false;
    }
  }

  /** Sell any inventory items the current planet buys.
   *  At the blackhole, illegal items are delivered (no cash, triggers growth). */
  private executeSell(managed: ManagedAgent, planetId: string): AgentDecisionTrace['sold'] {
    const { state } = managed;
    if (state.inventory.length === 0) return null;

    let totalProfit = 0;
    let totalQty = 0;
    const soldNames: string[] = [];
    const remaining: typeof state.inventory = [];

    for (const item of state.inventory) {
      const listing = getBuyListing(planetId, item.name);
      if (!listing) { remaining.push(item); continue; }

      if (planetId === 'blackhole' && listing.isIllegal) {
        // Deliver to blackhole — no cash, grows it
        growBlackhole(BLACKHOLE_GROWTH_PER_DELIVERY * item.quantity);
        this.scene.events.emit('BLACKHOLE_GROW', worldState.blackholeSize);
        soldNames.push(item.name);
        totalQty += item.quantity;
        totalProfit -= item.buyPrice * item.quantity; // spent this, got nothing
      } else {
        const revenue = listing.price * item.quantity;
        const cost = item.buyPrice * item.quantity;
        totalProfit += revenue - cost;
        totalQty += item.quantity;
        soldNames.push(item.name);
        state.cash += revenue;
      }
    }

    state.inventory = remaining;
    if (soldNames.length === 0) return null;
    return { goods: soldNames.join(' + '), quantity: totalQty, profit: totalProfit };
  }

  /** Buy goods per Claude's decision.
   *  Legal items: unlimited slots. Illegal items: only if carrying none already. */
  private executeBuy(
    managed: ManagedAgent,
    planetId: string,
    purchase: { itemName: string; quantity: number } | null,
  ): AgentDecisionTrace['bought'] {
    const { state } = managed;
    if (!purchase || purchase.itemName === 'none') return null;

    const listing = getSellListings(planetId).find(l => l.itemName === purchase.itemName);
    if (!listing) return null;

    // Illegal: only one at a time
    if (listing.isIllegal && state.inventory.some(i => i.isIllegal)) return null;

    const qty = listing.isIllegal ? 1 : Math.min(Math.max(1, purchase.quantity), 5);
    const totalCost = listing.price * qty;
    const minCashRequired = listing.isIllegal ? totalCost + ILLEGAL_CASH_RESERVE : totalCost;
    if (state.cash < minCashRequired) return null;

    state.cash -= totalCost;
    state.inventory.push({
      name: listing.itemName,
      quantity: qty,
      isIllegal: listing.isIllegal,
      buyPrice: listing.price,
    });

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
    if (!m) return;
    m.paused = true;
    if (m.movement.isMoving() && m.activeTrip) {
      const { toX, toY, toRadius, onArrival } = m.activeTrip;
      const { width: mapW, height: mapH } = this.map.getMapDimensions();
      const bhObstacle = this.blackHole && m.state.targetLocationId !== 'blackhole'
        ? [{ x: mapW / 2, y: mapH / 2, radius: this.blackHole.getRadius() }]
        : [];
      m.movement.pauseMidFlight(toX, toY, toRadius, onArrival, this.map.getAllPlanets(), mapW, mapH, bhObstacle);
    } else {
      m.movement.stop();
    }
  }

  resumeAgent(agentId: string): void {
    const m = this.agents.find(a => a.state.id === agentId);
    if (!m) return;
    m.paused = false;
    m.sprite.frozen = false;
    if (m.movement.hasInterruptedTrip()) {
      m.movement.resumeTravel();
    } else {
      m.state.lastDecisionAt = Date.now() - AGENT_DECISION_INTERVAL_MS;
    }
  }

  /** Spawn a new agent into the live game, assigned to a random active planet. */
  addAgent(agentState: AgentState): void {
    const { width: mapW, height: mapH } = this.map.getMapDimensions();

    // Pick a random currently-active non-blackhole planet
    const activePlanets = worldState.locations.filter(l => l.id !== 'blackhole');
    const startLoc = activePlanets[Math.floor(Math.random() * activePlanets.length)];
    agentState.currentPlanetId = startLoc.id;
    agentState.targetLocationId = startLoc.id;
    agentState.position = startLoc.tile;
    agentState.lastDecisionAt = Date.now() - AGENT_DECISION_INTERVAL_MS;

    const pos = this.map.getPlanetPixelPos(startLoc.id);
    const radius = this.map.getPlanetRadius(startLoc.id);
    const idx = this.agents.length;

    const sprite = new AgentSprite(this.scene, agentState, pos.x, pos.y, radius, idx);
    sprite.setBounds(mapW, mapH);

    sprite.getGraphics().on('pointerdown', () => {
      this.scene.events.emit('AGENT_SELECTED', agentState);
    });
    sprite.getGraphics().on('pointerover', () => {
      this.scene.input.setDefaultCursor('pointer');
    });
    sprite.getGraphics().on('pointerout', () => {
      this.scene.input.setDefaultCursor('default');
    });

    const movement = new MovementController(this.scene);
    this.agents.push({ state: agentState, sprite, movement, paused: false, activeTrip: null });
  }

  /** Remove an agent from the game entirely (sprite destroyed, no longer updated). */
  killAgent(agentId: string): void {
    const idx = this.agents.findIndex(a => a.state.id === agentId);
    if (idx === -1) return;
    const m = this.agents[idx];
    m.movement.stop();
    m.sprite.destroy();
    this.agents.splice(idx, 1);
    // Also remove from worldState so Claude doesn't see them
    const wsIdx = worldState.agents.findIndex(a => a.id === agentId);
    if (wsIdx !== -1) worldState.agents.splice(wsIdx, 1);
  }

  retriggerAgent(agentId: string): void {
    const m = this.agents.find(a => a.state.id === agentId);
    if (!m) return;
    m.paused = false;
    m.movement.stop();
    m.state.pendingDecision = false;
    m.state.lastDecisionAt = 0;
  }

  /** Immediately flee to the planet farthest from the blackhole (visible direction change). */
  fleeAgent(agentId: string): void {
    const m = this.agents.find(a => a.state.id === agentId);
    if (!m) return;

    m.paused = false;
    m.sprite.frozen = false;
    m.movement.stop();
    m.state.pendingDecision = false;

    // Pick the planet farthest from map center (farthest from blackhole),
    // excluding the current planet.
    const { width: mapW, height: mapH } = this.map.getMapDimensions();
    const cx = mapW / 2;
    const cy = mapH / 2;
    const candidates = this.map.getAllPlanets().filter(p => p.id !== m.state.currentPlanetId);
    const target = candidates.reduce((best, p) => {
      const px = p.xRatio * mapW;
      const py = p.yRatio * mapH;
      const d = Math.hypot(px - cx, py - cy);
      const bx = best.xRatio * mapW;
      const by = best.yRatio * mapH;
      const bd = Math.hypot(bx - cx, by - cy);
      return d > bd ? p : best;
    }, candidates[0]);

    if (!target) {
      // Fallback: just retrigger
      m.state.lastDecisionAt = 0;
      return;
    }

    m.state.mood = 'anxious';
    m.state.currentGoal = 'Getting out of here fast';
    m.state.currentThought = 'Nothing to see here, just passing through…';
    m.state.targetLocationId = target.id;
    m.sprite.updateMoodColor('anxious');
    m.sprite.showThoughtBubble('Nothing to see here, just passing through…', false);
    this.scene.events.emit('AGENT_UPDATED', m.state);

    const targetPos = this.map.getPlanetPixelPos(target.id);
    const targetRadius = this.map.getPlanetRadius(target.id);
    const onArrival = () => {
      m.state.currentPlanetId = target.id;
      m.state.position = {
        tileX: Math.round(targetPos.x / 32),
        tileY: Math.round(targetPos.y / 32),
      };
      m.activeTrip = null;
      m.state.lastDecisionAt = Date.now() - AGENT_DECISION_INTERVAL_MS;
    };
    const bhObstacle = this.blackHole
      ? [{ x: mapW / 2, y: mapH / 2, radius: this.blackHole.getRadius() }]
      : [];
    m.activeTrip = { toX: targetPos.x, toY: targetPos.y, toRadius: targetRadius, onArrival };
    m.movement.travelTo(m.sprite, targetPos.x, targetPos.y, targetRadius, onArrival, this.map.getAllPlanets(), mapW, mapH, bhObstacle);
  }

  getAgents(): ManagedAgent[] {
    return this.agents;
  }
}
