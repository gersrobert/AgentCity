// Space map — planets are the named locations agents travel between.

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

export const PLANETS: PlanetData[] = [
  {
    id: 'aquaria',
    label: 'Aquaria',
    description: 'A shimmering ocean world where thoughts flow like tidal currents.',
    assetKey: 'planet00',
    xRatio: 0.18,
    yRatio: 0.22,
    radius: 55,
    rotationSpeedDeg: 3,
    glowColor: 0x44aaff,
    accentColor: 0x88ddff,
  },
  {
    id: 'verdant',
    label: 'Verdant',
    description: 'A lush world humming with ancient biological wisdom.',
    assetKey: 'planet03',
    xRatio: 0.73,
    yRatio: 0.20,
    radius: 45,
    rotationSpeedDeg: 5,
    glowColor: 0x44ff88,
    accentColor: 0xaaffcc,
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'A volcanic world perpetually restless, where ambitions ignite.',
    assetKey: 'planet05',
    xRatio: 0.46,
    yRatio: 0.58,
    radius: 65,
    rotationSpeedDeg: 2,
    glowColor: 0xff6622,
    accentColor: 0xffaa44,
  },
  {
    id: 'nebula',
    label: 'Nebula Station',
    description: 'A small dense world wrapped in ionised mystery and strange transmissions.',
    assetKey: 'planet07',
    xRatio: 0.12,
    yRatio: 0.73,
    radius: 38,
    rotationSpeedDeg: 7,
    glowColor: 0xaa44ff,
    accentColor: 0xdd88ff,
  },
  {
    id: 'dune',
    label: 'Dune',
    description: 'An ancient desert world that has watched civilisations rise and crumble to dust.',
    assetKey: 'planet02',
    xRatio: 0.80,
    yRatio: 0.68,
    radius: 48,
    rotationSpeedDeg: 4,
    glowColor: 0xffaa44,
    accentColor: 0xffdd88,
  },
  {
    id: 'frost',
    label: 'Frost',
    description: 'A glacial world where silence stretches for eons and secrets freeze in place.',
    assetKey: 'planet01',
    xRatio: 0.38,
    yRatio: 0.10,
    radius: 35,
    rotationSpeedDeg: 6,
    glowColor: 0xaaddff,
    accentColor: 0xddeeff,
  },
  {
    id: 'terracis',
    label: 'Terracis',
    description: 'A rugged clay world where the ground remembers every footstep ever taken.',
    assetKey: 'planet04',
    xRatio: 0.62,
    yRatio: 0.84,
    radius: 42,
    rotationSpeedDeg: 3.5,
    glowColor: 0xbb8844,
    accentColor: 0xddbb88,
  },
  {
    id: 'aether',
    label: 'Aether',
    description: 'A teal world suspended in its own calm — everything here moves a little slower.',
    assetKey: 'planet06',
    xRatio: 0.90,
    yRatio: 0.42,
    radius: 38,
    rotationSpeedDeg: 4.5,
    glowColor: 0x44ffcc,
    accentColor: 0x88ffee,
  },
  {
    id: 'reverie',
    label: 'Reverie',
    description: 'A dreamy violet world where every cloud is a half-remembered thought.',
    assetKey: 'planet08',
    xRatio: 0.28,
    yRatio: 0.76,
    radius: 32,
    rotationSpeedDeg: 8,
    glowColor: 0xff66cc,
    accentColor: 0xffaaee,
  },
  {
    id: 'granite',
    label: 'Granite',
    description: 'A cratered grey world, stoic and unmoved, bearing the scars of a thousand impacts.',
    assetKey: 'planet09',
    xRatio: 0.55,
    yRatio: 0.30,
    radius: 52,
    rotationSpeedDeg: 1.5,
    glowColor: 0xaaaaaa,
    accentColor: 0xcccccc,
  },
];
