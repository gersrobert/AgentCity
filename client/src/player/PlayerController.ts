import Phaser from 'phaser';
import CityMap from '../map/CityMap';
import AgentManager from '../agents/AgentManager';

// The player is a special glowing orb (white/blue) that orbits planets.
// LEFT/RIGHT arrow keys (or A/D) cycle to the prev/next planet.
// E key inspects an agent on the same planet.

const PLAYER_COLOR = 0xffffff;
const PLAYER_ORBIT_SPEED = 0.0012; // rad/ms — faster than agents so player feels responsive
const ORBIT_OFFSET = 18;           // px extra beyond planet radius (slightly inside agent orbit)

export default class PlayerController {
  // Current position (world px)
  x = 0;
  y = 0;

  private scene: Phaser.Scene;
  private map: CityMap;
  private agentManager: AgentManager;

  // Orbit state
  private currentPlanetId: string;
  private planetX = 0;
  private planetY = 0;
  private orbitRadius = 0;
  private orbitAngle = 0;
  private traveling = false;

  // Visuals
  private orbGfx: Phaser.GameObjects.Graphics;
  private labelText: Phaser.GameObjects.Text;
  private promptText: Phaser.GameObjects.Text;
  private trailGfx: Phaser.GameObjects.Graphics;
  private trailPoints: { x: number; y: number }[] = [];

  // Input
  private keys!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    inspect: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene, map: CityMap, agentManager: AgentManager, startPlanetId: string) {
    this.scene = scene;
    this.map = map;
    this.agentManager = agentManager;
    this.currentPlanetId = startPlanetId;

    const pos = map.getPlanetPixelPos(startPlanetId);
    const r = map.getPlanetRadius(startPlanetId);
    this.planetX = pos.x;
    this.planetY = pos.y;
    this.orbitRadius = r + ORBIT_OFFSET;
    this.orbitAngle = Math.PI; // start on the left side

    this.x = this.planetX + Math.cos(this.orbitAngle) * this.orbitRadius;
    this.y = this.planetY + Math.sin(this.orbitAngle) * this.orbitRadius;

    // Visuals
    this.trailGfx = scene.add.graphics().setDepth(9);
    this.orbGfx = scene.add.graphics().setDepth(12);
    this.labelText = scene.add.text(this.x, this.y - 22, 'YOU', {
      fontSize: '10px',
      color: '#88ccff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2,
    }).setOrigin(0.5, 1).setDepth(13);

    this.promptText = scene.add.text(this.x, this.y - 36, '[E] Inspect', {
      fontSize: '8px',
      color: '#ffdd44',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2,
    }).setOrigin(0.5, 1).setDepth(13).setVisible(false);

    this.drawOrb();
    this.syncVisuals();

    // Input
    const kb = scene.input.keyboard!;
    this.keys = {
      left:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right:   kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      inspect: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
    };

    this.keys.left.on('down', () => this.travelToPlanet(-1));
    this.keys.right.on('down', () => this.travelToPlanet(1));
    this.keys.inspect.on('down', () => this.tryInspect());
  }

  update(delta: number): void {
    if (!this.traveling) {
      // Orbit current planet
      this.orbitAngle += PLAYER_ORBIT_SPEED * delta;
      this.x = this.planetX + Math.cos(this.orbitAngle) * this.orbitRadius;
      this.y = this.planetY + Math.sin(this.orbitAngle) * this.orbitRadius;
      this.syncVisuals();

      // Show inspect prompt if there's an agent to inspect here
      this.promptText.setVisible(this.hasNearbyAgent());
    } else {
      // Trail during travel
      this.trailPoints.push({ x: this.x, y: this.y });
      if (this.trailPoints.length > 40) this.trailPoints.shift();

      this.trailGfx.clear();
      for (let i = 1; i < this.trailPoints.length; i++) {
        const t = i / this.trailPoints.length;
        this.trailGfx.fillStyle(PLAYER_COLOR, t * 0.5);
        this.trailGfx.fillCircle(this.trailPoints[i].x, this.trailPoints[i].y, 1 + t * 2);
      }
    }
  }

  private travelToPlanet(direction: -1 | 1): void {
    if (this.traveling) return;

    const allPlanets = this.map.getAllPlanets();
    const idx = allPlanets.findIndex(p => p.id === this.currentPlanetId);
    const nextIdx = ((idx + direction) + allPlanets.length) % allPlanets.length;
    const target = allPlanets[nextIdx];

    const toPos = this.map.getPlanetPixelPos(target.id);
    const toRadius = this.map.getPlanetRadius(target.id);
    const orbitRadius = toRadius + ORBIT_OFFSET;

    const entryAngle = Math.atan2(this.y - toPos.y, this.x - toPos.x);
    const entryX = toPos.x + Math.cos(entryAngle) * orbitRadius;
    const entryY = toPos.y + Math.sin(entryAngle) * orbitRadius;

    const dist = Math.hypot(entryX - this.x, entryY - this.y);
    const duration = Math.max(1400, 600 + dist * 1.5);

    this.traveling = true;
    this.promptText.setVisible(false);

    const pos = { x: this.x, y: this.y };
    this.scene.tweens.add({
      targets: pos,
      x: entryX,
      y: entryY,
      duration,
      ease: 'Sine.InOut',
      onUpdate: () => {
        this.x = pos.x;
        this.y = pos.y;
        this.syncVisuals();
      },
      onComplete: () => {
        this.traveling = false;
        this.trailPoints = [];
        this.trailGfx.clear();
        this.currentPlanetId = target.id;
        this.planetX = toPos.x;
        this.planetY = toPos.y;
        this.orbitRadius = orbitRadius;
        this.orbitAngle = entryAngle;
        this.x = entryX;
        this.y = entryY;
        this.syncVisuals();
      },
    });
  }

  private tryInspect(): void {
    if (this.traveling) return;
    const agents = this.agentManager.getAgents();
    for (const managed of agents) {
      if (
        managed.state.currentPlanetId === this.currentPlanetId &&
        !managed.movement.isMoving()
      ) {
        this.agentManager.pauseAgent(managed.state.id);
        this.scene.events.emit('AGENT_SELECTED', managed.state);
        return;
      }
    }
  }

  private hasNearbyAgent(): boolean {
    const agents = this.agentManager.getAgents();
    return agents.some(
      m => m.state.currentPlanetId === this.currentPlanetId && !m.movement.isMoving()
    );
  }

  private drawOrb(): void {
    this.orbGfx.clear();
    // Outer halo (white-blue tint)
    this.orbGfx.fillStyle(0x88ccff, 0.1);
    this.orbGfx.fillCircle(0, 0, 20);
    // Mid glow
    this.orbGfx.fillStyle(0xaaddff, 0.3);
    this.orbGfx.fillCircle(0, 0, 12);
    // Core
    this.orbGfx.fillStyle(0xffffff, 0.95);
    this.orbGfx.fillCircle(0, 0, 6);
    // Blue inner spark
    this.orbGfx.fillStyle(0x88ccff, 1);
    this.orbGfx.fillCircle(0, 0, 3);
    // Bright center
    this.orbGfx.fillStyle(0xffffff, 1);
    this.orbGfx.fillCircle(0, 0, 1.5);
  }

  private syncVisuals(): void {
    this.orbGfx.setPosition(this.x, this.y);
    this.labelText.setPosition(this.x, this.y - 22);
    this.promptText.setPosition(this.x, this.y - 36);
  }

  getCurrentPlanetId(): string {
    return this.currentPlanetId;
  }

  destroy(): void {
    this.orbGfx.destroy();
    this.labelText.destroy();
    this.promptText.destroy();
    this.trailGfx.destroy();
  }
}
