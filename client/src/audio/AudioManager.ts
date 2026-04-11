import Phaser from 'phaser';

/**
 * AudioManager — procedural SFX + file-based rocket engine.
 * BGM is the original procedural ambient chord pad.
 */

export default class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private bgmGain!: GainNode;
  private bgmRunning = false;
  private muted = false;

  // Phaser sound for rocket engine (loaded as 'rocket_engine')
  private rocketSound: Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | null = null;

  // ── Singleton ──────────────────────────────────────────────────────────────
  private static instance: AudioManager | null = null;
  static getInstance(): AudioManager {
    if (!AudioManager.instance) AudioManager.instance = new AudioManager();
    return AudioManager.instance;
  }

  // ── Init (call once on first user interaction to unlock AudioContext) ──────
  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.55;
    this.masterGain.connect(this.ctx.destination);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.18;
    this.bgmGain.connect(this.masterGain);

    this.startBackgroundMusic();
  }

  /** Call once GameScene is ready so Phaser can provide the rocket engine sound. */
  initPhaserSounds(scene: Phaser.Scene): void {
    if (this.rocketSound) return;
    this.rocketSound = scene.sound.add('rocket_engine', { loop: true, volume: 0 }) as
      Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
    this.rocketSound.play();
  }

  /** Fade rocket engine sound in/out based on whether the player is thrusting. */
  setRocketThrusting(active: boolean): void {
    if (!this.rocketSound) return;
    const target = active ? 0.55 : 0;
    this.rocketSound.setVolume(target);
  }

  toggle(): void {
    this.muted = !this.muted;
    if (this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.1);
    }
    if (this.rocketSound) {
      // let setRocketThrusting handle volume; just silence when muted
      if (this.muted) this.rocketSound.setVolume(0);
    }
  }

  isMuted(): boolean { return this.muted; }

  // ══ Public sound triggers ═══════════════════════════════════════════════════

  playRocketThrust(): void { /* now handled via setRocketThrusting */ }
  playSell(profit: number): void { this.coinSound(profit >= 0); }
  playBuy(): void { this.buySound(); }
  playInspect(): void { this.inspectSound(); }
  playExplosion(): void { this.explosionSound(); }
  playBlackholeGrow(): void { this.blackholeGrowSound(); }
  playAgentSpawn(): void { this.spawnSound(false); }
  playPlanetSpawn(): void { this.spawnSound(true); }

  // ══ Background music (procedural ambient pad) ════════════════════════════════

  private startBackgroundMusic(): void {
    if (this.bgmRunning || !this.ctx) return;
    this.bgmRunning = true;
    this.scheduleBgmLoop();
  }

  private scheduleBgmLoop(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const gain = this.bgmGain;
    const now = ctx.currentTime;

    // Slow ambient chord pad — four stacked sine waves
    const notes = [110, 138.6, 164.8, 220]; // A2, C#3, E3, A3  (A minor)
    const duration = 8;

    for (const freq of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.3, now + 2);
      g.gain.linearRampToValueAtTime(0.3, now + duration - 2);
      g.gain.linearRampToValueAtTime(0, now + duration);
      osc.connect(g);
      g.connect(gain);
      osc.start(now);
      osc.stop(now + duration);
    }

    // Subtle low drone
    const drone = ctx.createOscillator();
    const dg = ctx.createGain();
    drone.type = 'sawtooth';
    drone.frequency.value = 55;
    dg.gain.setValueAtTime(0, now);
    dg.gain.linearRampToValueAtTime(0.05, now + 3);
    dg.gain.linearRampToValueAtTime(0.05, now + duration - 3);
    dg.gain.linearRampToValueAtTime(0, now + duration);
    drone.connect(dg);
    dg.connect(gain);
    drone.start(now);
    drone.stop(now + duration);

    // Schedule the next iteration before this one ends
    setTimeout(() => this.scheduleBgmLoop(), (duration - 0.5) * 1000);
  }

  // ══ Individual sound synthesis ══════════════════════════════════════════════

  private thrustSound(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = 0.14;

    // ── Noise roar: broadband noise shaped through a low-pass for body ──────
    const bufSize = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Low-pass keeps the warm low-mid roar, cuts the harsh treble
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    lp.Q.value = 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(lp);
    lp.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    src.start(now);

    // ── Deep sub-oscillator: adds the chest-felt bass rumble ────────────────
    const sub = ctx.createOscillator();
    sub.type = 'sawtooth';
    // Slight pitch wobble (mimics combustion flutter)
    sub.frequency.setValueAtTime(68, now);
    sub.frequency.linearRampToValueAtTime(58, now + dur);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.28, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + dur + 0.01);
  }

  private coinSound(positive: boolean): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Two quick "dings" pitched up or down
    const freqs = positive ? [880, 1320] : [440, 330];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = now + i * 0.08;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  private buySound(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Short descending blip — "spending"
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.15);
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  private inspectSound(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Rising two-tone "scanner ping"
    [440, 660, 880].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const t = now + i * 0.07;
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  private explosionSound(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Low boom via noise + lowpass
    const bufSize = ctx.sampleRate * 0.9;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;

    const g = ctx.createGain();
    g.gain.setValueAtTime(1.0, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

    src.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
  }

  private blackholeGrowSound(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep rumble sweep downward
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.6);
    g.gain.setValueAtTime(0.0, now);
    g.gain.linearRampToValueAtTime(0.4, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  private spawnSound(isPlanet: boolean): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Planet: deep whoosh; Agent: ascending chime
    if (isPlanet) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.5);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.3, now + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.55);
    } else {
      // Agent: two-note ascending "hello"
      [523, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = now + i * 0.1;
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    }
  }

  // ── Helper ─────────────────────────────────────────────────────────────────

  private getCtx(): AudioContext | null {
    if (!this.ctx) return null;
    // Resume if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
}
