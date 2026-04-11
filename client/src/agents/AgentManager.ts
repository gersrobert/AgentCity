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
import AudioManager from '../audio/AudioManager';

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
  private player: { x: number; y: number } | null = null;
  private inspectedAgentId: string | null = null;

  constructor(scene: Phaser.Scene, map: CityMap) {
    this.scene = scene;
    this.map = map;
  }

  setBlackHole(bh: BlackHole): void {
    this.blackHole = bh;
  }

  setPlayerRef(player: { x: number; y: number }): void {
    this.player = player;
  }

  private isPlayerNear(ax: number, ay: number): boolean {
    if (!this.player) return true; // no ref set — allow (fallback)
    return Math.hypot(ax - this.player.x, ay - this.player.y) <= 90;
  }

  /** Pause agentId and open the inspector. If another agent was already open, resume it first. */
  openInspection(agentId: string): void {
    if (this.inspectedAgentId && this.inspectedAgentId !== agentId) {
      this.resumeAgent(this.inspectedAgentId);
      this.scene.events.emit('INSPECTION_CLOSED');
    }
    this.inspectedAgentId = agentId;
    this.pauseAgent(agentId);
    const m = this.agents.find(a => a.state.id === agentId);
    if (m) this.scene.events.emit('AGENT_SELECTED', m.state);
  }

  /** Called by UIScene / RocketController when inspection is dismissed. */
  closeInspection(agentId: string): void {
    if (this.inspectedAgentId === agentId) {
      this.inspectedAgentId = null;
    }
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
        if (!this.isPlayerNear(sprite.x, sprite.y)) return;
        this.openInspection(agentState.id);
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

    // Auto-close inspection when player drifts out of range
    if (this.inspectedAgentId && this.player) {
      const m = this.agents.find(a => a.state.id === this.inspectedAgentId);
      if (m && !this.isPlayerNear(m.sprite.x, m.sprite.y)) {
        this.resumeAgent(this.inspectedAgentId);
        this.inspectedAgentId = null;
        this.scene.events.emit('INSPECTION_CLOSED');
      }
    }

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
          .map(({ id, name, mood, mission }) => ({ id, name, mood, mission })),
      };

      const decision = await backendClient.agentThink(request);

      // Execute trades when the agent just arrived at a planet
      const soldRecord = atPlanet ? this.executeSell(managed, state.currentPlanetId) : null;
      const boughtItem = atPlanet ? this.executeBuy(managed, state.currentPlanetId, decision.purchase) : null;

      // Show money pop-ups above the agent and play audio
      if (soldRecord) {
        sprite.showMoneyPopup(Math.abs(soldRecord.profit), soldRecord.profit >= 0);
        AudioManager.getInstance().playSell(soldRecord.profit);
      }
      if (boughtItem) {
        // Small delay so sell and buy pops don't overlap exactly
        this.scene.time.delayedCall(300, () => {
          sprite.showMoneyPopup(boughtItem.cost, false);
          AudioManager.getInstance().playBuy();
        });
      }

      // Apply state changes
      state.mood = decision.newMood;
      state.currentThought = decision.thought;
      state.targetLocationId = decision.targetLocationId;

      // Update visuals
      sprite.updateMoodColor(state.mood);
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

      // If the agent was paused while the LLM was thinking, don't start travel.
      // The decision is stored so resumeAgent can kick off movement when ready.
      if (managed.paused) {
        state.lastDecisionAt = Date.now() - AGENT_DECISION_INTERVAL_MS; // re-decide promptly after resume
        return;
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
      if (!this.isPlayerNear(sprite.x, sprite.y)) return;
      this.openInspection(agentState.id);
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
    this.scene.events.emit('AGENT_KILLED');
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
    m.state.currentThought = 'Nothing to see here, just passing through…';
    m.state.targetLocationId = target.id;
    m.sprite.updateMoodColor('anxious');
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

  /** Play a random explosion at the agent's position, then permanently remove them. */
  explodeAgent(agentId: string): void {
    const idx = this.agents.findIndex(a => a.state.id === agentId);
    if (idx === -1) return;

    const managed = this.agents[idx];
    const { x, y } = managed.sprite;

    // Pick a random animation set
    const variants = [
      { prefix: 'exp-d-', frames: 12 },
      { prefix: 'exp-f-', frames: 8 },
      { prefix: 'exp-g-', frames: 7 },
      { prefix: 'exp-b-', frames: 12 },
    ];
    const pick = variants[Math.floor(Math.random() * variants.length)];

    // Destroy the agent sprite immediately so it vanishes
    managed.sprite.destroy();
    managed.movement.stop();
    this.agents.splice(idx, 1);
    // Also remove from worldState so it no longer participates in AI calls
    const wsIdx = worldState.agents.findIndex(a => a.id === agentId);
    if (wsIdx !== -1) worldState.agents.splice(wsIdx, 1);
    this.scene.events.emit('AGENT_KILLED');

    // Animate the explosion using individual image frames via a timer
    const SIZE = 120;
    const img = this.scene.add.image(x, y, `${pick.prefix}1`).setDisplaySize(SIZE, SIZE).setDepth(50);
    let frame = 1;

    this.scene.time.addEvent({
      delay: 55,
      repeat: pick.frames - 1,
      callback: () => {
        frame++;
        if (frame <= pick.frames) {
          img.setTexture(`${pick.prefix}${frame}`);
        } else {
          img.destroy();
        }
      },
    });
  }
}
