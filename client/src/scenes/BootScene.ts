import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

const PLANET_KEYS = [
  'planet00', 'planet01', 'planet02', 'planet03', 'planet04',
  'planet05', 'planet06', 'planet07', 'planet08', 'planet09',
];

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.cameras.main;

    // Loading bar background
    const barBg = this.add.graphics();
    barBg.fillStyle(0x221144, 1);
    barBg.fillRoundedRect(width / 2 - 102, height / 2 - 12, 204, 24, 6);

    const progress = this.add.graphics();

    this.load.on('progress', (value: number) => {
      progress.clear();
      progress.fillStyle(0x8844ff, 1);
      progress.fillRoundedRect(width / 2 - 100, height / 2 - 10, 200 * value, 20, 4);
    });

    this.add.text(width / 2, height / 2 - 50, 'AGENTCITY', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 6,
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 40, 'Loading universe...', {
      fontSize: '12px',
      color: '#8866aa',
    }).setOrigin(0.5);

    // Load all planet images
    for (const key of PLANET_KEYS) {
      this.load.image(key, `planets/${key}.png`);
    }

    // Player ship
    this.load.image('player_ship', 'ships/Spaceship_9.png');

    // Explosion animations
    for (let i = 1; i <= 12; i++) this.load.image(`exp-d-${i}`,  `explosions/explosion-1-d/explosion-d${i}.png`);
    for (let i = 1; i <= 8;  i++) this.load.image(`exp-f-${i}`,  `explosions/explosion-1-f/explosion-f${i}.png`);
    for (let i = 1; i <= 7;  i++) this.load.image(`exp-g-${i}`,  `explosions/explosion-1-g/frame${i}.png`);
    for (let i = 1; i <= 12; i++) this.load.image(`exp-b-${i}`,  `explosions/explosion-b/explosion-b${i}.png`);
  }

  create(): void {
    this.scene.start('ApiKeyScene');
  }
}
