import Phaser from "phaser";
import CityMap from "../map/CityMap";
import AgentManager from "../agents/AgentManager";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  MAP_WIDTH_TILES,
  MAP_HEIGHT_TILES,
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

    // Set world bounds for camera
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

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

    this.cameras.main.setZoom(2);

    // Camera drag (right-click or middle-click drag)
    this.setupCameraControls();

    // Listen for agent selection
    this.events.on("AGENT_SELECTED", (agent: AgentState) => {
      this.selectedAgentId = agent.id;
      // Follow the selected agent with the camera
      const managed = this.agentManager
        .getAgents()
        .find((m) => m.state.id === agent.id);
      if (managed) {
        // Smoothly pan camera to agent
        this.cameras.main.pan(
          managed.sprite.x,
          managed.sprite.y,
          500,
          "Power2",
        );
      }
    });

    // Listen for world events from UIScene
    this.events.on("WORLD_EVENT", (event: WorldEvent) => {
      this.handleWorldEvent(event);
    });

    // Status text
    this.add
      .text(8, 8, "AgentCity", {
        fontSize: "12px",
        color: "#ffdd44",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
        resolution: 2,
      })
      .setScrollFactor(0)
      .setDepth(50);

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

  private setupCameraControls(): void {
    // Arrow keys / WASD camera pan
    const cursors = this.input.keyboard!.createCursorKeys();
    const wasd = this.input.keyboard!.addKeys("W,A,S,D") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;

    const CAM_SPEED = 4;

    this.input.keyboard!.on("keydown", () => {
      // deselect agent when moving camera manually
      this.selectedAgentId = null;
    });

    // Update loop for camera movement
    this.events.on("update", () => {
      const cam = this.cameras.main;
      if (cursors.left.isDown || wasd["A"].isDown) {
        cam.scrollX -= CAM_SPEED / cam.zoom;
      }
      if (cursors.right.isDown || wasd["D"].isDown) {
        cam.scrollX += CAM_SPEED / cam.zoom;
      }
      if (cursors.up.isDown || wasd["W"].isDown) {
        cam.scrollY -= CAM_SPEED / cam.zoom;
      }
      if (cursors.down.isDown || wasd["S"].isDown) {
        cam.scrollY += CAM_SPEED / cam.zoom;
      }
    });

    // Scroll wheel zoom
    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _objs: unknown,
        _dx: number,
        _dy: number,
        dy: number,
      ) => {
        const cam = this.cameras.main;
        const newZoom = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.8, 4);
        cam.setZoom(newZoom);
      },
    );
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
