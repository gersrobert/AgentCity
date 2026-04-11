import Phaser from 'phaser';
import AgentSprite from './AgentSprite';

export default class MovementController {
  private scene: Phaser.Scene;
  private activeTween: Phaser.Tweens.Tween | null = null;
  private _traveling = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  travelTo(
    orb: AgentSprite,
    toX: number,
    toY: number,
    toRadius: number,
    onArrival: () => void,
  ): void {
    this.stop();

    orb.traveling = true;
    this._traveling = true;

    // Compute the point on the orbit ring closest to the orb's current position
    const orbitRadius = toRadius + 22;
    const entryAngle = Math.atan2(orb.y - toY, orb.x - toX);
    const entryX = toX + Math.cos(entryAngle) * orbitRadius;
    const entryY = toY + Math.sin(entryAngle) * orbitRadius;

    const dist = Math.hypot(entryX - orb.x, entryY - orb.y);
    const duration = Math.max(1800, 800 + dist * 1.8);

    // Use an intermediate proxy so the tween drives orb.x / orb.y
    const pos = { x: orb.x, y: orb.y };

    this.activeTween = this.scene.tweens.add({
      targets: pos,
      x: entryX,
      y: entryY,
      duration,
      ease: 'Sine.InOut',
      onUpdate: () => {
        orb.setPosition(pos.x, pos.y);
        orb.updateTrail();
      },
      onComplete: () => {
        this._traveling = false;
        this.activeTween = null;
        orb.arriveAtPlanet(toX, toY, toRadius, entryAngle);
        onArrival();
      },
    });
  }

  isMoving(): boolean {
    return this._traveling;
  }

  stop(): void {
    this.activeTween?.stop();
    this.activeTween = null;
    this._traveling = false;
  }
}
