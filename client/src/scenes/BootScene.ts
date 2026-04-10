import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // No external assets in the prototype — everything is drawn procedurally.
    // This scene exists so we can add real asset loading here later.

    const { width, height } = this.cameras.main;

    // Loading screen
    const bar = this.add.graphics();
    bar.fillStyle(0x6644aa, 1);
    bar.fillRect(width / 2 - 100, height / 2 - 10, 200, 20);

    const progress = this.add.graphics();

    this.load.on('progress', (value: number) => {
      progress.clear();
      progress.fillStyle(0xffdd44, 1);
      progress.fillRect(width / 2 - 98, height / 2 - 8, 196 * value, 16);
    });

    const title = this.add.text(width / 2, height / 2 - 40, 'AgentCity', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    const sub = this.add.text(width / 2, height / 2 + 34, 'Loading...', {
      fontSize: '12px',
      color: '#aaaaaa',
    });
    sub.setOrigin(0.5);
  }

  create(): void {
    this.scene.start('ApiKeyScene');
  }
}
