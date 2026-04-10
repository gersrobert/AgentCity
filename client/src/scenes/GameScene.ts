import Phaser from "phaser";
import CityMap from "../map/CityMap";
import AgentManager from "../agents/AgentManager";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  MAP_WIDTH_TILES,
  MAP_HEIGHT_TILES,
  RIGHT_PANEL_WIDTH,
} from "../config";
import type { WorldEvent, AgentState } from "@shared/types";
import { NAMED_LOCATIONS } from "../map/mapData";

export default class GameScene extends Phaser.Scene {
  private cityMap!: CityMap;
  private agentManager!: AgentManager;
  private selectedAgentId: string | null = null;

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    const worldWidth = MAP_WIDTH_TILES * TILE_SIZE;
    const worldHeight = MAP_HEIGHT_TILES * TILE_SIZE;

    // Camera viewport excludes the right panel
    const mapAreaWidth = GAME_WIDTH - RIGHT_PANEL_WIDTH;
    this.cameras.main.setViewport(0, 0, mapAreaWidth, GAME_HEIGHT);

    // Zoom so the whole map fits in the viewport
    const zoom = Math.min(mapAreaWidth / worldWidth, GAME_HEIGHT / worldHeight);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);

    // Create map
    this.cityMap = new CityMap();
    this.cityMap.drawPlaceholder(this);

    // Draw location labels on map
    this.drawLocationLabels();

    // Create and init agents
    this.agentManager = new AgentManager(this, this.cityMap);
    this.agentManager.init();

    // Camera: start centered on the plaza
    const plaza = this.cityMap.getLocation("plaza");
    if (plaza) {
      const worldPos = this.cityMap.tileToWorld(plaza.tile);
      this.cameras.main.centerOn(worldPos.x, worldPos.y);
    }

    // Listen for agent selection
    this.events.on("AGENT_SELECTED", (agent: AgentState) => {
      this.selectedAgentId = agent.id;
    });

    // Listen for world events from UIScene
    this.events.on("WORLD_EVENT", (event: WorldEvent) => {
      this.handleWorldEvent(event);
    });

    // Bring UI scene on top
    this.scene.bringToTop("UIScene");
  }

  update(time: number, delta: number): void {
    this.agentManager.update(time, delta);
  }

  private drawLocationLabels(): void {
    for (const loc of NAMED_LOCATIONS) {
      const wx = loc.tileX * TILE_SIZE + TILE_SIZE / 2;
      const wy = loc.tileY * TILE_SIZE - 4;

      this.add
        .text(wx, wy, loc.label, {
          fontSize: "8px",
          color: "#ffdd44",
          stroke: "#000000",
          strokeThickness: 2,
          resolution: 2,
        })
        .setOrigin(0.5, 1)
        .setDepth(5);
    }
  }

  private handleWorldEvent(event: WorldEvent): void {
    // Visual feedback for weather changes
    if (event.stateChanges.weather) {
      this.showWeatherToast(event.stateChanges.weather);
    }
  }

  private showWeatherToast(weather: string): void {
    const { width, height } = this.cameras.main;
    const text = this.add.text(
      width / 2,
      height / 2 - 80,
      `Weather: ${weather}`,
      {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#44228888",
        padding: { x: 10, y: 6 },
        resolution: 2,
      },
    );
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(200);

    this.tweens.add({
      targets: text,
      alpha: 0,
      duration: 2000,
      delay: 1500,
      onComplete: () => text.destroy(),
    });
  }
}
