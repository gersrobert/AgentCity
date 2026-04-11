import Phaser from 'phaser';
import CityMap from '../map/CityMap';
import AgentManager from '../agents/AgentManager';
import RocketController from '../player/RocketController';
import BlackHole from '../map/BlackHole';
import { PLANETS, PlanetData } from '../map/mapData';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  RIGHT_PANEL_WIDTH,
  STAR_COUNT,
  TWINKLE_STAR_COUNT,
  NEBULA_OPACITY,
  STARTING_PLANET_COUNT,
  PLANET_UNLOCK_INTERVAL_MS,
  AGENT_UNLOCK_INTERVAL_MS,
} from '../config';
import type { WorldEvent, AgentState } from '@shared/types';
import { worldState, unlockPlanet } from '../store/worldState';
import * as backendClient from '../api/backendClient';

export default class GameScene extends Phaser.Scene {
  private cityMap!: CityMap;
  private agentManager!: AgentManager;
  private rocket!: RocketController;
  private blackHole!: BlackHole;
  private planetImages: Phaser.GameObjects.Image[] = [];
  private planetRotSpeeds: number[] = [];
  private selectedAgentId: string | null = null;

  // Progressive unlock state
  private nextPlanetIdx = STARTING_PLANET_COUNT;
  private nextAgentIdx  = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    const mapWidth = GAME_WIDTH - RIGHT_PANEL_WIDTH;
    const mapHeight = GAME_HEIGHT;

    this.cameras.main.setViewport(0, 0, mapWidth, mapHeight);
    this.cameras.main.setZoom(1);
    this.cameras.main.setBackgroundColor('#000510');

    this.createNebulae(mapWidth, mapHeight);
    this.createStarField(mapWidth, mapHeight);

    this.blackHole = new BlackHole(this, mapWidth / 2, mapHeight / 2);

    // ── Planets (starting set only) ──────────────────────────────────────────
    this.cityMap = new CityMap(mapWidth, mapHeight);
    for (let i = 0; i < STARTING_PLANET_COUNT; i++) {
      this.renderPlanet(PLANETS[i]);
    }

    // ── Agents ──────────────────────────────────────────────────────────────
    // Clear any seed agents — all agents are spawned dynamically via LLM
    worldState.agents = [];
    this.agentManager = new AgentManager(this, this.cityMap);
    this.agentManager.setBlackHole(this.blackHole);
    this.agentManager.init();

    // Spawn the first agent immediately
    this.addNextAgent();

    // ── Player rocket ────────────────────────────────────────────────────────
    const startPos = this.cityMap.getPlanetPixelPos('aquaria');
    const startR   = this.cityMap.getPlanetRadius('aquaria');
    this.rocket = new RocketController(
      this, this.cityMap, this.agentManager,
      startPos.x - startR - 50, startPos.y,
    );

    // ── Progressive unlock timers ────────────────────────────────────────────
    this.time.addEvent({
      delay: PLANET_UNLOCK_INTERVAL_MS,
      callback: this.unlockNextPlanet,
      callbackScope: this,
      loop: true,
    });
    this.time.addEvent({
      delay: AGENT_UNLOCK_INTERVAL_MS,
      callback: this.addNextAgent,
      callbackScope: this,
      loop: true,
    });

    // ── Events ──────────────────────────────────────────────────────────────
    this.events.on('AGENT_SELECTED', (agent: AgentState) => {
      this.selectedAgentId = agent.id;
    });

    this.events.on('AGENT_RESUME', (agentId: string) => {
      this.agentManager.resumeAgent(agentId);
    });

    this.events.on('RETRIGGER_AGENT', (agentId: string) => {
      this.agentManager.retriggerAgent(agentId);
    });

    this.events.on('EXPLODE_AGENT', (agentId: string) => {
      this.agentManager.explodeAgent(agentId);
    });

    // Respawn a replacement agent 15 s after any kill
    this.events.on('AGENT_KILLED', () => {
      this.time.delayedCall(15_000, () => this.addNextAgent());
    });

    this.events.on('FLEE_AGENT', (agentId: string) => {
      this.agentManager.fleeAgent(agentId);
    });

    this.events.on('KILL_AGENT', (agentId: string) => {
      this.agentManager.killAgent(agentId);
    });

    this.events.on('WORLD_EVENT', (event: WorldEvent) => {
      this.handleWorldEvent(event);
    });

    this.events.on('BLACKHOLE_GROW', (sizeFraction: number) => {
      this.blackHole.setSizeFraction(sizeFraction);
      this.scene.get('UIScene').events.emit('BLACKHOLE_GROW', sizeFraction);
    });

    this.scene.bringToTop('UIScene');
  }

  update(_time: number, delta: number): void {
    for (let i = 0; i < this.planetImages.length; i++) {
      this.planetImages[i].angle += this.planetRotSpeeds[i] * (delta / 1000);
    }

    this.blackHole.update(delta);
    this.rocket.update(delta);
    this.agentManager.update(_time, delta);
  }

  // ── Progressive unlock ────────────────────────────────────────────────────

  private unlockNextPlanet(): void {
    if (this.nextPlanetIdx >= PLANETS.length) return;
    const planet = PLANETS[this.nextPlanetIdx++];
    unlockPlanet(planet);
    this.renderPlanet(planet);
    this.showEventToast(`${planet.label} has entered the system.`);
  }

  private async addNextAgent(): Promise<void> {
    const agentIdx = this.nextAgentIdx++;
    const activePlanets = worldState.locations.filter(l => l.id !== 'blackhole');
    const startLoc = activePlanets[agentIdx % activePlanets.length];

    try {
      const profile = await backendClient.spawnAgent({
        existingAgentNames: worldState.agents.map(a => a.name),
        startingPlanetId: startLoc.id,
        worldContext: {
          weather: worldState.weather,
          activeEvents: worldState.activeEvents,
        },
      });

      const agentState: AgentState = {
        id: `agent_${agentIdx}`,
        name: profile.name,
        personality: profile.personality,
        mood: profile.mood,
        currentGoal: profile.currentGoal,
        currentThought: profile.currentThought,
        currentPlanetId: startLoc.id,
        position: startLoc.tile,
        targetLocationId: startLoc.id,
        lastDecisionAt: 0,
        pendingDecision: false,
        cash: 100,
        inventory: [],
      };

      worldState.agents.push(agentState);
      this.agentManager.addAgent(agentState);
      this.showEventToast(`${agentState.name} has arrived in the system.`);
    } catch (err) {
      console.warn('[GameScene] Failed to spawn agent via LLM:', err);
    }
  }

  // ── Private builders ──────────────────────────────────────────────────────

  private renderPlanet(planet: PlanetData): void {
    const { width: w, height: h } = this.cityMap.getMapDimensions();
    const x = Math.round(planet.xRatio * w);
    const y = Math.round(planet.yRatio * h);
    const r = planet.radius;

    this.drawPlanetGlow(x, y, r, planet.glowColor);
    const img = this.drawPlanetImage(x, y, r, planet);
    this.drawPlanetLabel(x, y, r, planet);

    img.setInteractive(new Phaser.Geom.Circle(0, 0, r), Phaser.Geom.Circle.Contains);

    this.planetImages.push(img);
    this.planetRotSpeeds.push(planet.rotationSpeedDeg);
  }

  private createNebulae(w: number, h: number): void {
    const g = this.add.graphics().setDepth(0);

    const blobs = [
      { x: w * 0.25, y: h * 0.15, rx: 380, ry: 240, color: 0x220055 },
      { x: w * 0.75, y: h * 0.80, rx: 420, ry: 280, color: 0x001144 },
      { x: w * 0.60, y: h * 0.35, rx: 300, ry: 200, color: 0x110033 },
      { x: w * 0.10, y: h * 0.65, rx: 260, ry: 180, color: 0x002211 },
    ];

    for (const b of blobs) {
      g.fillStyle(b.color, NEBULA_OPACITY * 1.5);
      g.fillEllipse(b.x, b.y, b.rx * 2, b.ry * 2);
      g.fillStyle(b.color, NEBULA_OPACITY);
      g.fillEllipse(b.x, b.y, b.rx * 3.5, b.ry * 3.5);
    }
  }

  private createStarField(w: number, h: number): void {
    const staticGfx = this.add.graphics().setDepth(1);
    for (let i = 0; i < STAR_COUNT; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = Math.random() < 0.85 ? 0.7 : 1.4;
      const alpha = 0.15 + Math.random() * 0.7;
      staticGfx.fillStyle(0xffffff, alpha);
      staticGfx.fillCircle(x, y, size);
    }

    for (let i = 0; i < TWINKLE_STAR_COUNT; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = 0.8 + Math.random() * 1.2;

      const star = this.add.graphics().setDepth(1);
      star.fillStyle(0xffffff, 1);
      star.fillCircle(x, y, size);

      this.tweens.add({
        targets: star,
        alpha: { from: 0.05, to: 0.9 + Math.random() * 0.1 },
        duration: 600 + Math.random() * 2400,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 4000,
      });
    }
  }

  private drawPlanetGlow(x: number, y: number, r: number, color: number): void {
    const g = this.add.graphics().setDepth(2);

    g.fillStyle(color, 0.04);
    g.fillCircle(x, y, r * 2.6);
    g.fillStyle(color, 0.08);
    g.fillCircle(x, y, r * 1.85);
    g.fillStyle(color, 0.14);
    g.fillCircle(x, y, r * 1.45);
    g.fillStyle(color, 0.10);
    g.fillCircle(x, y, r * 1.15);
  }

  private drawPlanetImage(x: number, y: number, r: number, planet: PlanetData): Phaser.GameObjects.Image {
    const img = this.add.image(x, y, planet.assetKey);
    img.setDisplaySize(r * 2, r * 2);
    img.setDepth(3);

    const maskGfx = this.make.graphics({});
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillCircle(x, y, r - 1);
    img.setMask(maskGfx.createGeometryMask());

    return img;
  }

  private drawPlanetLabel(x: number, y: number, r: number, planet: PlanetData): void {
    this.add
      .text(x, y + r + 14, planet.label, {
        fontSize: '12px',
        color: '#ccccdd',
        stroke: '#000000',
        strokeThickness: 3,
        resolution: 2,
      })
      .setAlpha(0.85)
      .setOrigin(0.5, 0)
      .setDepth(5);
  }

  private handleWorldEvent(event: WorldEvent): void {
    if (event.stateChanges.weather || event.stateChanges.activeEvents?.length) {
      this.showEventToast(event.narrative);
    }
  }

  private showEventToast(narrative: string): void {
    const mapWidth = GAME_WIDTH - RIGHT_PANEL_WIDTH;
    const maxLen = 80;
    const display = narrative.length > maxLen ? narrative.slice(0, maxLen) + '…' : narrative;

    const text = this.add.text(mapWidth / 2, GAME_HEIGHT * 0.08, display, {
      fontSize: '13px',
      color: '#eeeeff',
      backgroundColor: '#22004488',
      padding: { x: 14, y: 8 },
      stroke: '#6644aa',
      strokeThickness: 1,
      resolution: 2,
      wordWrap: { width: mapWidth * 0.7 },
      align: 'center',
    });
    text.setOrigin(0.5, 0).setScrollFactor(0).setDepth(200);

    this.tweens.add({
      targets: text,
      alpha: 0,
      duration: 2500,
      delay: 2500,
      onComplete: () => text.destroy(),
    });
  }
}
