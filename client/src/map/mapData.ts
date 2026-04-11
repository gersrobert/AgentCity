// Space map — planets are the named locations agents travel between.
// Positions are arranged in two rings around the central black hole (0.5, 0.5).
//
// Inner ring (5 planets) — ~28% from center
// Outer ring (5 planets) — ~40% from center, offset by half a step

export interface PlanetData {
  id: string;
  label: string;
  description: string;
  assetKey: string;
  /** Position as a ratio of the map viewport (0–1) */
  xRatio: number;
  yRatio: number;
  /** Display radius in pixels */
  radius: number;
  /** Rotation speed in degrees per second */
  rotationSpeedDeg: number;
  /** Colour of the ambient glow (hex) */
  glowColor: number;
  /** Orb tint for agents arriving at this planet (unused — kept for future) */
  accentColor: number;
}

// Helper: evenly spaced angle for item i of n, offset by a starting angle (radians)
function ring(i: number, n: number, r: number, startAngle = 0): { xRatio: number; yRatio: number } {
  const angle = startAngle + (i / n) * Math.PI * 2;
  return {
    xRatio: 0.5 + Math.cos(angle) * r,
    yRatio: 0.5 + Math.sin(angle) * r * 1.15, // slight vertical stretch to fill the viewport
  };
}

const INNER = (i: number) => ring(i, 5, 0.27, -Math.PI / 2);
const OUTER = (i: number) => ring(i, 5, 0.40, -Math.PI / 2 + Math.PI / 5); // half-step offset

export const PLANETS: PlanetData[] = [
  // ── Inner ring ────────────────────────────────────────────────────────────
  {
    id: 'aquaria',
    label: 'Aquaria',
    description: 'A shimmering ocean world where thoughts flow like tidal currents.',
    assetKey: 'planet00',
    ...INNER(0),
    radius: 52,
    rotationSpeedDeg: 3,
    glowColor: 0x44aaff,
    accentColor: 0x88ddff,
  },
  {
    id: 'verdant',
    label: 'Verdant',
    description: 'A lush world humming with ancient biological wisdom.',
    assetKey: 'planet03',
    ...INNER(1),
    radius: 44,
    rotationSpeedDeg: 5,
    glowColor: 0x44ff88,
    accentColor: 0xaaffcc,
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'A volcanic world perpetually restless, where ambitions ignite.',
    assetKey: 'planet05',
    ...INNER(2),
    radius: 58,
    rotationSpeedDeg: 2,
    glowColor: 0xff6622,
    accentColor: 0xffaa44,
  },
  {
    id: 'nebula',
    label: 'Nebula Station',
    description: 'A small dense world wrapped in ionised mystery and strange transmissions.',
    assetKey: 'planet07',
    ...INNER(3),
    radius: 36,
    rotationSpeedDeg: 7,
    glowColor: 0xaa44ff,
    accentColor: 0xdd88ff,
  },
  {
    id: 'frost',
    label: 'Frost',
    description: 'A glacial world where silence stretches for eons and secrets freeze in place.',
    assetKey: 'planet01',
    ...INNER(4),
    radius: 38,
    rotationSpeedDeg: 6,
    glowColor: 0xaaddff,
    accentColor: 0xddeeff,
  },

  // ── Outer ring ────────────────────────────────────────────────────────────
  {
    id: 'dune',
    label: 'Dune',
    description: 'An ancient desert world that has watched civilisations rise and crumble to dust.',
    assetKey: 'planet02',
    ...OUTER(0),
    radius: 46,
    rotationSpeedDeg: 4,
    glowColor: 0xffaa44,
    accentColor: 0xffdd88,
  },
  {
    id: 'granite',
    label: 'Granite',
    description: 'A cratered grey world, stoic and unmoved, bearing the scars of a thousand impacts.',
    assetKey: 'planet09',
    ...OUTER(1),
    radius: 50,
    rotationSpeedDeg: 1.5,
    glowColor: 0xaaaaaa,
    accentColor: 0xcccccc,
  },
  {
    id: 'aether',
    label: 'Aether',
    description: 'A teal world suspended in its own calm — everything here moves a little slower.',
    assetKey: 'planet06',
    ...OUTER(2),
    radius: 40,
    rotationSpeedDeg: 4.5,
    glowColor: 0x44ffcc,
    accentColor: 0x88ffee,
  },
  {
    id: 'terracis',
    label: 'Terracis',
    description: 'A rugged clay world where the ground remembers every footstep ever taken.',
    assetKey: 'planet04',
    ...OUTER(3),
    radius: 42,
    rotationSpeedDeg: 3.5,
    glowColor: 0xbb8844,
    accentColor: 0xddbb88,
  },
  {
    id: 'reverie',
    label: 'Reverie',
    description: 'A dreamy violet world where every cloud is a half-remembered thought.',
    assetKey: 'planet08',
    ...OUTER(4),
    radius: 34,
    rotationSpeedDeg: 8,
    glowColor: 0xff66cc,
    accentColor: 0xffaaee,
  },
];
