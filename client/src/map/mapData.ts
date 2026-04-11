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
    radius: 85,
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
    radius: 70,
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
    radius: 100,
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
    radius: 60,
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
    radius: 75,
    rotationSpeedDeg: 4,
    glowColor: 0xffaa44,
    accentColor: 0xffdd88,
  },
];
