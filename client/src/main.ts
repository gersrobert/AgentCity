import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import BootScene from './scenes/BootScene';
import ApiKeyScene from './scenes/ApiKeyScene';
import GameScene from './scenes/GameScene';
import UIScene from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#2d5a27',
  parent: document.body,
  dom: {
    createContainer: true,
  },
  scale: {
    mode: Phaser.Scale.NONE,
  },
  scene: [BootScene, ApiKeyScene, GameScene, UIScene],
};

new Phaser.Game(config);
