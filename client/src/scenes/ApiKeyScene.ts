import Phaser from "phaser";
import * as backendClient from "../api/backendClient";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { worldState } from "../store/worldState";
import AudioManager from "../audio/AudioManager";

// The lore panels shown before the game starts.
// Each panel is displayed for ~3.5 seconds with a fade transition.
const LORE_PANELS = [
  {
    lines: [
      "Long ago, this system thrived.",
      "Ten worlds. Countless traders.",
      "A civilization that believed it had built something permanent.",
    ],
  },
  {
    lines: [
      "Then the traders changed.",
      "They began carrying something new.",
      "Something that had no name in any known language.",
    ],
  },
  {
    lines: [
      'In the old tongue, the word was "nic".',
      "It meant: nothing.",
      "They thought naming it would contain it.",
      "They were wrong.",
    ],
  },
  {
    lines: [
      "Now Nothing grows at the centre of everything.",
      "It does not destroy.",
      "It simply... removes.",
      "First a particle. Then a planet.",
      "Then the memory that it existed.",
    ],
  },
];

export default class ApiKeyScene extends Phaser.Scene {
  // Lore panels
  private lorePanelIdx = 0;
  private lorePanelContainer: Phaser.GameObjects.Container | null = null;
  private skipText: Phaser.GameObjects.Text | null = null;
  private skipping = false;

  // Final panel: title + enter button
  private titlePanel: Phaser.GameObjects.Container | null = null;

  // Loading UI
  private loadingText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "ApiKeyScene" });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Full-screen dark background
    this.add.graphics().fillStyle(0x000008, 1).fillRect(0, 0, width, height);

    // Starfield for atmosphere
    this.createStarField(width, height);

    AudioManager.getInstance().init();

    // Show a loading message while we spawn the first agent
    this.loadingText = this.add
      .text(width / 2, height / 2, "Summoning ranger to the system...", {
        fontSize: "13px",
        color: "#556688",
        fontFamily: "monospace",
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: this.loadingText,
      alpha: 1,
      duration: 800,
    });

    this.spawnAndStartLore();
  }

  // ── Spawn first agent then begin lore ────────────────────────────────────

  private async spawnAndStartLore(): Promise<void> {
    try {
      const activePlanets = worldState.locations.filter(
        (l) => l.id !== "blackhole",
      );
      const startLoc = activePlanets[0];
      const firstAgentProfile = await backendClient.spawnAgent({
        existingAgentNames: [],
        startingPlanetId: startLoc.id,
        worldContext: {
          weather: worldState.weather,
          activeEvents: worldState.activeEvents,
        },
      });

      // Fade out loading text, then start lore sequence
      this.tweens.add({
        targets: this.loadingText,
        alpha: 0,
        duration: 600,
        onComplete: () => {
          this.loadingText?.destroy();
          this.loadingText = null;
          this.startLoreSequence(firstAgentProfile, startLoc.id);
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect.";
      if (this.loadingText) {
        this.loadingText.setText(msg);
        this.loadingText.setColor("#aa4433");
      }
    }
  }

  // ── Lore panels ──────────────────────────────────────────────────────────

  private startLoreSequence(
    firstAgentProfile: unknown,
    firstAgentPlanetId: string,
  ): void {
    const { width, height } = this.cameras.main;

    // Skip hint
    this.skipText = this.add
      .text(width - 28, height - 24, "SKIP ›", {
        fontSize: "10px",
        color: "#334466",
        fontFamily: "monospace",
        letterSpacing: 2,
      })
      .setOrigin(1, 1)
      .setDepth(20)
      .setInteractive({ cursor: "pointer" });

    this.skipText.on("pointerover", () => this.skipText?.setColor("#6688bb"));
    this.skipText.on("pointerout", () => this.skipText?.setColor("#334466"));
    this.skipText.on("pointerdown", () => {
      if (!this.skipping) {
        this.skipping = true;
        this.lorePanelContainer?.destroy();
        this.skipText?.destroy();
        this.showTitlePanel(firstAgentProfile, firstAgentPlanetId);
      }
    });

    this.showNextLorePanel(firstAgentProfile, firstAgentPlanetId);
  }

  private showNextLorePanel(
    firstAgentProfile: unknown,
    firstAgentPlanetId: string,
  ): void {
    if (this.skipping) return;
    if (this.lorePanelIdx >= LORE_PANELS.length) {
      this.showTitlePanel(firstAgentProfile, firstAgentPlanetId);
      return;
    }

    const panel = LORE_PANELS[this.lorePanelIdx];
    this.lorePanelIdx++;

    this.showLinesSequentially(
      panel.lines,
      0,
      firstAgentProfile,
      firstAgentPlanetId,
    );
  }

  /**
   * Displays lines one by one: fade in -> hold -> fade out -> next line.
   * After the last line of the panel, moves on to the next panel.
   */
  private showLinesSequentially(
    lines: string[],
    idx: number,
    firstAgentProfile: unknown,
    firstAgentPlanetId: string,
  ): void {
    if (this.skipping) return;

    if (idx >= lines.length) {
      this.time.delayedCall(400, () =>
        this.showNextLorePanel(firstAgentProfile, firstAgentPlanetId),
      );
      return;
    }

    const { width, height } = this.cameras.main;

    this.lorePanelContainer?.destroy();
    this.lorePanelContainer = this.add.container(width / 2, height / 2);

    const t = this.add
      .text(0, 0, lines[idx], {
        fontSize: "18px",
        color: "#99bbdd",
        fontFamily: "monospace",
        align: "center",
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.lorePanelContainer.add(t);

    const FADE_IN_MS = 900;
    const HOLD_MS = 2400;
    const FADE_OUT_MS = 1600;

    this.tweens.add({
      targets: t,
      alpha: 1,
      duration: FADE_IN_MS,
      onComplete: () => {
        if (this.skipping) return;
        this.time.delayedCall(HOLD_MS, () => {
          if (this.skipping) return;
          this.tweens.add({
            targets: t,
            alpha: 0,
            duration: FADE_OUT_MS,
            onComplete: () =>
              this.showLinesSequentially(
                lines,
                idx + 1,
                firstAgentProfile,
                firstAgentPlanetId,
              ),
          });
        });
      },
    });
  }

  // ── Final panel: Title + Enter ───────────────────────────────────────────

  private showTitlePanel(
    firstAgentProfile: unknown,
    firstAgentPlanetId: string,
  ): void {
    const { width, height } = this.cameras.main;

    this.titlePanel = this.add.container(width / 2, height / 2);

    const title = this.add
      .text(0, -80, "NIC", {
        fontSize: "96px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
        letterSpacing: 20,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const tagline = this.add
      .text(0, 10, '"They thought naming it would contain it."', {
        fontSize: "13px",
        color: "#445566",
        fontFamily: "monospace",
        fontStyle: "italic",
        letterSpacing: 1,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const enterHtml = `
      <button id="enter-btn" style="
        background: transparent;
        color: #556688;
        border: 1px solid #334466;
        border-radius: 4px;
        padding: 10px 40px;
        font-size: 12px;
        cursor: pointer;
        font-family: monospace;
        letter-spacing: 4px;
        transition: border-color 0.2s, color 0.2s;
      "
      onmouseover="this.style.borderColor='#6688bb';this.style.color='#aaccff';"
      onmouseout="this.style.borderColor='#334466';this.style.color='#556688';"
      >ENTER</button>
    `;
    const enterDom = this.add
      .dom(width / 2, height / 2 + 90)
      .createFromHTML(enterHtml);
    enterDom.setDepth(20).setAlpha(0);

    this.titlePanel.add([title, tagline]);

    this.tweens.add({ targets: title, alpha: 1, duration: 1400, delay: 200 });
    this.tweens.add({
      targets: tagline,
      alpha: 1,
      duration: 1000,
      delay: 1000,
    });
    this.tweens.add({
      targets: enterDom,
      alpha: 1,
      duration: 800,
      delay: 1600,
    });

    enterDom.addListener("click");
    enterDom.on("click", (event: MouseEvent) => {
      if ((event.target as HTMLElement).id === "enter-btn") {
        enterDom.setInteractive(false);
        this.beginGame(
          firstAgentProfile,
          firstAgentPlanetId,
          title,
          tagline,
          enterDom,
        );
      }
    });

    this.skipText?.destroy();
  }

  private beginGame(
    firstAgentProfile: unknown,
    firstAgentPlanetId: string,
    title: Phaser.GameObjects.Text,
    tagline: Phaser.GameObjects.Text,
    enterDom: Phaser.GameObjects.DOMElement,
  ): void {
    const { width, height } = this.cameras.main;

    this.tweens.add({
      targets: [title, tagline, enterDom],
      alpha: 0,
      duration: 800,
    });

    const fade = this.add.graphics().setDepth(50);
    fade.fillStyle(0x000000, 0).fillRect(0, 0, width, height);
    this.tweens.add({
      targets: fade,
      alpha: { from: 0, to: 1 },
      duration: 900,
      delay: 400,
      onComplete: () => {
        this.scene.start("GameScene", {
          firstAgentProfile,
          firstAgentPlanetId,
        });
        this.scene.launch("UIScene");
      },
    });
  }

  // ── Starfield ────────────────────────────────────────────────────────────

  private createStarField(w: number, h: number): void {
    const gfx = this.add.graphics().setDepth(0);
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = Math.random() < 0.85 ? 0.5 : 1.0;
      const alpha = 0.05 + Math.random() * 0.35;
      gfx.fillStyle(0xffffff, alpha);
      gfx.fillCircle(x, y, size);
    }

    for (let i = 0; i < 25; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const star = this.add.graphics().setDepth(0);
      star.fillStyle(0xaabbcc, 1);
      star.fillCircle(x, y, 0.7 + Math.random() * 0.8);
      this.tweens.add({
        targets: star,
        alpha: { from: 0.03, to: 0.5 + Math.random() * 0.4 },
        duration: 1200 + Math.random() * 3000,
        ease: "Sine.InOut",
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 5000,
      });
    }
  }
}
