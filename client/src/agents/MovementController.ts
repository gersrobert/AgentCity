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
  passThroughPoints: Vec2[];
}

/**
 * Returns waypoints that steer around any obstacle whose body overlaps the
 * straight-line path from `start` to `end`.
 *
 * One waypoint per intersecting obstacle, placed outside the avoidance radius
 * in the perpendicular-away-from-obstacle direction.  When the path passes
 * exactly through the obstacle centre (degenerate case) the path's own
 * left-normal is used so the waypoint is never placed at the centre itself.
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
  const len = Math.sqrt(lenSq) || 1;

  for (const planet of planets) {
    const avoidRadius = planet.radius + clearance;

    // Parametric closest point on segment
    const t = lenSq > 0
      ? Math.max(0, Math.min(1, ((planet.x - start.x) * dx + (planet.y - start.y) * dy) / lenSq))
      : 0;

    const closestX = start.x + t * dx;
    const closestY = start.y + t * dy;
    const distToPath = Math.hypot(planet.x - closestX, planet.y - closestY);

    if (distToPath >= avoidRadius || t <= 0.05 || t >= 0.95) continue;

    // Direction from planet centre away from the path.
    // When the path passes through the planet centre (distToPath ≈ 0) the
    // perpendicular is undefined — fall back to the path's left-normal so the
    // waypoint is never placed at the obstacle centre.
    let nx: number, ny: number;
    if (distToPath > 0.5) {
      nx = (closestX - planet.x) / distToPath;
      ny = (closestY - planet.y) / distToPath;
    } else {
      nx = -dy / len;
      ny =  dx / len;
    }

    // Waypoint is placed just outside the avoidance radius from the planet centre
    waypoints.push({
      x: planet.x + nx * (avoidRadius + 20),
      y: planet.y + ny * (avoidRadius + 20),
      t,
    });
  }

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
    passThroughPoints: Vec2[] = [],
  ): void {
    this.stop();
    this._interrupted = null;

    orb.traveling = true;
    this._traveling = true;
    this._orb = orb;

    this._startTrip(orb, toX, toY, toRadius, onArrival, allPlanets, mapWidth, mapHeight, extraObstacles, passThroughPoints);
  }

  /** Restart an interrupted mid-flight trip from the agent's current position. */
  resumeTravel(): void {
    const trip = this._interrupted;
    if (!trip) return;
    this._interrupted = null;

    const { orb, toX, toY, toRadius, onArrival, allPlanets, mapWidth, mapHeight, extraObstacles, passThroughPoints } = trip;
    orb.traveling = true;
    this._traveling = true;
    this._orb = orb;

    this._startTrip(orb, toX, toY, toRadius, onArrival, allPlanets, mapWidth, mapHeight, extraObstacles, passThroughPoints);
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
    passThroughPoints: Vec2[] = [],
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

    const start: Vec2 = { x: orb.x, y: orb.y };
    const end: Vec2 = { x: entryX, y: entryY };

    // For each extra obstacle (the blackhole), compute a forced bypass point so
    // agents always arc around it — even when the direct path never intersects it
    // (e.g. adjacent inner-ring planets both on the same side).
    // The bypass sits at the average orbital distance of start/end, in the
    // direction from the obstacle toward the midpoint of the trip.
    const forcedBypass: Vec2[] = [];
    for (const obs of extraObstacles) {
      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2;
      const dmx = mx - obs.x;
      const dmy = my - obs.y;
      const dmLen = Math.hypot(dmx, dmy);

      if (dmLen < 20) {
        // Planets nearly opposite — the direct path crosses the obstacle centre;
        // buildWaypoints handles that case via intersection detection.
        continue;
      }

      const rStart = Math.hypot(start.x - obs.x, start.y - obs.y);
      const rEnd   = Math.hypot(end.x   - obs.x, end.y   - obs.y);
      const rBypass = (rStart + rEnd) / 2;

      forcedBypass.push({
        x: obs.x + (dmx / dmLen) * rBypass,
        y: obs.y + (dmy / dmLen) * rBypass,
      });
    }

    const allStops = [start, ...forcedBypass, ...passThroughPoints, end];
    const path: Vec2[] = [start];
    for (let i = 1; i < allStops.length; i++) {
      const avoidance = buildWaypoints(allStops[i - 1], allStops[i], planetObstacles);
      path.push(...avoidance, allStops[i]);
    }

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
    passThroughPoints: Vec2[] = [],
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
      passThroughPoints,
    };

    // Keep orb frozen at current position — do NOT clear traveling on the sprite
    // so updateOrbit() won't snap it back to the origin planet
    this._orb.frozen = true;
    this._orb = null;
  }
}
