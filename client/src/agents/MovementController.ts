import Phaser from 'phaser';
import AgentSprite from './AgentSprite';
import type { PlanetData } from '../map/mapData';

// Distance multiplier for travel speed — higher = slower agents
const SPEED_FACTOR = 16.0; // was 1.8

interface Vec2 { x: number; y: number }

interface InterruptedTrip {
  orb: AgentSprite;
  toX: number;
  toY: number;
  toRadius: number;
  onArrival: () => void;
  allPlanets: PlanetData[];
  mapWidth: number;
  mapHeight: number;
  extraObstacles: Array<{ x: number; y: number; radius: number }>;
}

/**
 * Returns a list of intermediate waypoints that steer around any planet
 * whose body overlaps the straight-line path from `start` to `end`.
 *
 * Algorithm: for each planet, compute the closest point on the segment.
 * If that point is within (radius + clearance) of the planet centre,
 * insert one waypoint offset perpendicularly away from the planet.
 * Waypoints are sorted by distance along the original path so the agent
 * always moves in the correct direction.
 */
function buildWaypoints(
  start: Vec2,
  end: Vec2,
  planets: Array<{ x: number; y: number; radius: number }>,
  clearance = 28,
): Vec2[] {
  const waypoints: Array<Vec2 & { t: number }> = [];

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;

  for (const planet of planets) {
    const avoidRadius = planet.radius + clearance;

    // Parametric closest point on segment
    const t = lenSq > 0
      ? Math.max(0, Math.min(1, ((planet.x - start.x) * dx + (planet.y - start.y) * dy) / lenSq))
      : 0;

    const closestX = start.x + t * dx;
    const closestY = start.y + t * dy;
    const distToPath = Math.hypot(planet.x - closestX, planet.y - closestY);

    if (distToPath < avoidRadius && t > 0.05 && t < 0.95) {
      // Perpendicular direction away from planet
      const perpX = closestX - planet.x;
      const perpY = closestY - planet.y;
      const perpLen = Math.hypot(perpX, perpY) || 1;

      const pushDist = avoidRadius - distToPath + 20; // extra buffer
      waypoints.push({
        x: closestX + (perpX / perpLen) * pushDist,
        y: closestY + (perpY / perpLen) * pushDist,
        t,
      });
    }
  }

  // Sort waypoints by their position along the original path
  waypoints.sort((a, b) => a.t - b.t);

  return waypoints;
}

export default class MovementController {
  private scene: Phaser.Scene;
  private activeTween: Phaser.Tweens.Tween | null = null;
  private _traveling = false;
  private _orb: AgentSprite | null = null;
  private _interrupted: InterruptedTrip | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  travelTo(
    orb: AgentSprite,
    toX: number,
    toY: number,
    toRadius: number,
    onArrival: () => void,
    allPlanets: PlanetData[] = [],
    mapWidth = 1,
    mapHeight = 1,
    extraObstacles: Array<{ x: number; y: number; radius: number }> = [],
  ): void {
    this.stop();
    this._interrupted = null;

    orb.traveling = true;
    this._traveling = true;
    this._orb = orb;

    this._startTrip(orb, toX, toY, toRadius, onArrival, allPlanets, mapWidth, mapHeight, extraObstacles);
  }

  /** Restart an interrupted mid-flight trip from the agent's current position. */
  resumeTravel(): void {
    const trip = this._interrupted;
    if (!trip) return;
    this._interrupted = null;

    const { orb, toX, toY, toRadius, onArrival, allPlanets, mapWidth, mapHeight, extraObstacles } = trip;
    orb.traveling = true;
    this._traveling = true;
    this._orb = orb;

    this._startTrip(orb, toX, toY, toRadius, onArrival, allPlanets, mapWidth, mapHeight, extraObstacles);
  }

  hasInterruptedTrip(): boolean {
    return this._interrupted !== null;
  }

  private _startTrip(
    orb: AgentSprite,
    toX: number,
    toY: number,
    toRadius: number,
    onArrival: () => void,
    allPlanets: PlanetData[],
    mapWidth: number,
    mapHeight: number,
    extraObstacles: Array<{ x: number; y: number; radius: number }> = [],
  ): void {
    // Entry point on destination orbit ring
    const orbitRadius = toRadius + 22;
    const entryAngle = Math.atan2(orb.y - toY, orb.x - toX);
    const entryX = toX + Math.cos(entryAngle) * orbitRadius;
    const entryY = toY + Math.sin(entryAngle) * orbitRadius;

    // Build obstacle list for avoidance (pixel coords)
    const planetObstacles = [
      ...allPlanets.map((p) => ({
        x: Math.round(p.xRatio * mapWidth),
        y: Math.round(p.yRatio * mapHeight),
        radius: p.radius,
      })),
      ...extraObstacles,
    ];

    // Compute avoidance waypoints
    const start: Vec2 = { x: orb.x, y: orb.y };
    const end: Vec2 = { x: entryX, y: entryY };
    const midpoints = buildWaypoints(start, end, planetObstacles);

    // Full path: start → waypoints → end
    const path: Vec2[] = [start, ...midpoints, end];

    // Total path length for duration calculation
    let totalDist = 0;
    for (let i = 1; i < path.length; i++) {
      totalDist += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    const totalDuration = Math.max(8000, 800 + totalDist * SPEED_FACTOR);

    // Chain tweens for each segment, proportional to segment length
    this._travelSegments(orb, path, 1, totalDist, totalDuration, toX, toY, toRadius, entryAngle, onArrival);
  }

  private _travelSegments(
    orb: AgentSprite,
    path: Vec2[],
    segIndex: number,
    totalDist: number,
    totalDuration: number,
    toX: number,
    toY: number,
    toRadius: number,
    entryAngle: number,
    onArrival: () => void,
  ): void {
    if (segIndex >= path.length) {
      this._traveling = false;
      this.activeTween = null;
      this._orb = null;
      orb.arriveAtPlanet(toX, toY, toRadius, entryAngle);
      onArrival();
      return;
    }

    const from = path[segIndex - 1];
    const to = path[segIndex];
    const segDist = Math.hypot(to.x - from.x, to.y - from.y);
    const segDuration = totalDist > 0 ? (segDist / totalDist) * totalDuration : totalDuration;

    const pos = { x: from.x, y: from.y };

    this.activeTween = this.scene.tweens.add({
      targets: pos,
      x: to.x,
      y: to.y,
      duration: segDuration,
      ease: segIndex === 1 ? 'Sine.In' : segIndex === path.length - 1 ? 'Sine.Out' : 'Linear',
      onUpdate: () => {
        orb.setPosition(pos.x, pos.y);
        orb.updateTrail();
      },
      onComplete: () => {
        if (!this._traveling) return; // was stopped
        this._travelSegments(orb, path, segIndex + 1, totalDist, totalDuration, toX, toY, toRadius, entryAngle, onArrival);
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
    if (this._orb) {
      this._orb.traveling = false;
      this._orb = null;
    }
  }

  /** Pause mid-flight: freeze the agent in place and remember the destination. */
  pauseMidFlight(
    toX: number,
    toY: number,
    toRadius: number,
    onArrival: () => void,
    allPlanets: PlanetData[],
    mapWidth: number,
    mapHeight: number,
    extraObstacles: Array<{ x: number; y: number; radius: number }> = [],
  ): void {
    if (!this._traveling || !this._orb) return;

    this.activeTween?.stop();
    this.activeTween = null;
    this._traveling = false;

    // Store trip so resumeTravel() can continue from current position
    this._interrupted = {
      orb: this._orb,
      toX,
      toY,
      toRadius,
      onArrival,
      allPlanets,
      mapWidth,
      mapHeight,
      extraObstacles,
    };

    // Keep orb frozen at current position — do NOT clear traveling on the sprite
    // so updateOrbit() won't snap it back to the origin planet
    this._orb.frozen = true;
    this._orb = null;
  }
}
