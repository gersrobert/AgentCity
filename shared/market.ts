// ─── Inter-planetary goods market ────────────────────────────────────────────
// Each planet has items it sells (agents can buy) and items it accepts from agents.
// No item appears in both lists for the same planet.
//
// Resource categories:
//   Botanicals  — medicinal herbs, bloom extract, dream pollen, spore clusters
//   Ores        — iron ore, volcanic glass, rare minerals, ancient stone
//   Food        — ocean pearls, tidal salt, desert spice, preserved rations
//   Textiles    — nebula silk, dyed cloth, calm essence, woven charms
//   Tech        — cryo shards, navigation crystals, clay tablets, void circuits
//   Contraband  — psyche spores ★, stolen relics ★, dark matter ★

// Agents won't buy illegal goods if their remaining cash would fall below this.
// Ensures they keep enough credits to continue legal trading afterwards.
export const ILLEGAL_CASH_RESERVE = 50;

export interface MarketListing {
  itemName: string;
  price: number;
  isIllegal: boolean;
}

export interface LocationMarket {
  sells: MarketListing[];
  buys:  MarketListing[];
}

export const MARKET: Record<string, LocationMarket> = {
  // ── Food & Spices hub ─────────────────────────────────────────────────────
  aquaria: {
    sells: [
      { itemName: 'ocean pearls',   price: 18, isIllegal: false }, // Food
      { itemName: 'tidal salt',     price: 12, isIllegal: false }, // Food
      { itemName: 'psyche spores',  price: 160, isIllegal: true }, // Contraband ★
    ],
    buys: [
      { itemName: 'nebula silk',    price: 30, isIllegal: false },
      { itemName: 'iron ore',       price: 24, isIllegal: false },
    ],
  },

  // ── Botanicals hub ────────────────────────────────────────────────────────
  verdant: {
    sells: [
      { itemName: 'medicinal herbs', price: 14, isIllegal: false }, // Botanicals
      { itemName: 'bloom extract',   price: 20, isIllegal: false }, // Botanicals
      { itemName: 'stolen relics',   price: 120, isIllegal: true }, // Contraband ★
    ],
    buys: [
      { itemName: 'desert spice',   price: 26, isIllegal: false },
      { itemName: 'iron ore',       price: 22, isIllegal: false },
    ],
  },

  // ── Ores & Minerals hub ───────────────────────────────────────────────────
  ember: {
    sells: [
      { itemName: 'iron ore',       price: 10, isIllegal: false }, // Ores
      { itemName: 'volcanic glass', price: 16, isIllegal: false }, // Ores
      { itemName: 'psyche spores',  price: 160, isIllegal: true }, // Contraband ★
    ],
    buys: [
      { itemName: 'tidal salt',     price: 22, isIllegal: false },
      { itemName: 'nebula silk',    price: 32, isIllegal: false },
    ],
  },

  // ── Textiles & Crafts hub ─────────────────────────────────────────────────
  nebula: {
    sells: [
      { itemName: 'nebula silk',    price: 18, isIllegal: false }, // Textiles
      { itemName: 'dyed cloth',     price: 13, isIllegal: false }, // Textiles
      { itemName: 'stolen relics',  price: 120, isIllegal: true }, // Contraband ★
    ],
    buys: [
      { itemName: 'bloom extract',  price: 30, isIllegal: false },
      { itemName: 'void circuits',  price: 28, isIllegal: false },
    ],
  },

  // ── Tech & Navigation hub ─────────────────────────────────────────────────
  frost: {
    sells: [
      { itemName: 'cryo shards',          price: 16, isIllegal: false }, // Tech
      { itemName: 'navigation crystals',  price: 22, isIllegal: false }, // Tech
      { itemName: 'dark matter',          price: 190, isIllegal: true }, // Contraband ★
    ],
    buys: [
      { itemName: 'iron ore',       price: 28, isIllegal: false },
      { itemName: 'nebula silk',    price: 34, isIllegal: false },
    ],
  },

  // ── Food & Spices hub (outer) ─────────────────────────────────────────────
  dune: {
    sells: [
      { itemName: 'desert spice',     price: 11, isIllegal: false }, // Food
      { itemName: 'preserved rations', price: 9, isIllegal: false }, // Food
      { itemName: 'psyche spores',    price: 160, isIllegal: true }, // Contraband ★
    ],
    buys: [
      { itemName: 'ocean pearls',   price: 30, isIllegal: false },
      { itemName: 'iron ore',       price: 20, isIllegal: false },
    ],
  },

  // ── Ores & Minerals hub (outer) ───────────────────────────────────────────
  granite: {
    sells: [
      { itemName: 'ancient stone',  price: 13, isIllegal: false }, // Ores
      { itemName: 'rare minerals',  price: 17, isIllegal: false }, // Ores
      { itemName: 'dark matter',    price: 190, isIllegal: true }, // Contraband ★
    ],
    buys: [
      { itemName: 'dream pollen',   price: 25, isIllegal: false },
      { itemName: 'nebula silk',    price: 38, isIllegal: false },
    ],
  },

  // ── Textiles & Crafts hub (outer) ─────────────────────────────────────────
  aether: {
    sells: [
      { itemName: 'calm essence',   price: 22, isIllegal: false }, // Textiles
      { itemName: 'woven charms',   price: 15, isIllegal: false }, // Textiles
      { itemName: 'psyche spores',  price: 160, isIllegal: true }, // Contraband ★
    ],
    buys: [
      { itemName: 'clay tablets',   price: 20, isIllegal: false },
      { itemName: 'medicinal herbs', price: 28, isIllegal: false },
    ],
  },

  // ── Tech & Navigation hub (outer) ────────────────────────────────────────
  terracis: {
    sells: [
      { itemName: 'clay tablets',   price: 11, isIllegal: false }, // Tech
      { itemName: 'void circuits',  price: 19, isIllegal: false }, // Tech
      { itemName: 'dark matter',    price: 190, isIllegal: true }, // Contraband ★
    ],
    buys: [
      { itemName: 'cryo shards',    price: 28, isIllegal: false },
      { itemName: 'ocean pearls',   price: 22, isIllegal: false },
    ],
  },

  // ── Botanicals hub (outer) ────────────────────────────────────────────────
  reverie: {
    sells: [
      { itemName: 'dream pollen',   price: 14, isIllegal: false }, // Botanicals
      { itemName: 'spore clusters', price: 17, isIllegal: false }, // Botanicals
      { itemName: 'stolen relics',  price: 120, isIllegal: true }, // Contraband ★
    ],
    buys: [
      { itemName: 'calm essence',   price: 38, isIllegal: false },
      { itemName: 'cryo shards',    price: 28, isIllegal: false },
    ],
  },

  // The blackhole accepts illegal deliveries — agents deliver here for no money,
  // but each delivery grows the blackhole. It sells nothing.
  blackhole: {
    sells: [],
    buys: [
      { itemName: 'dark matter',    price: 0, isIllegal: true },
      { itemName: 'stolen relics',  price: 0, isIllegal: true },
      { itemName: 'psyche spores',  price: 0, isIllegal: true },
    ],
  },
};

/** Items available for agents to acquire at this planet. */
export function getSellListings(locationId: string): MarketListing[] {
  return MARKET[locationId]?.sells ?? [];
}

/** What this planet will pay to buy an item. Returns undefined if it doesn't buy that item. */
export function getBuyListing(locationId: string, itemName: string): MarketListing | undefined {
  return MARKET[locationId]?.buys.find(b => b.itemName === itemName);
}

/** All planets that will buy a given item, sorted by price descending. */
export function getBuyersFor(itemName: string): { locationId: string; price: number }[] {
  return Object.entries(MARKET)
    .flatMap(([locationId, market]) => {
      const listing = market.buys.find(b => b.itemName === itemName);
      return listing ? [{ locationId, price: listing.price }] : [];
    })
    .sort((a, b) => b.price - a.price);
}

/** Whether an item is considered illegal anywhere in the market. */
export function isItemIllegal(itemName: string): boolean {
  for (const market of Object.values(MARKET)) {
    const found = [...market.sells, ...market.buys].find(l => l.itemName === itemName);
    if (found) return found.isIllegal;
  }
  return false;
}

// ─── Planet resource category descriptions (for spawn prompt context) ─────────
export const PLANET_RESOURCE_CATEGORY: Record<string, string> = {
  aquaria:  'Food & Spices (ocean pearls, tidal salt)',
  verdant:  'Botanicals (medicinal herbs, bloom extract)',
  ember:    'Ores & Minerals (iron ore, volcanic glass)',
  nebula:   'Textiles & Crafts (nebula silk, dyed cloth)',
  frost:    'Tech & Navigation (cryo shards, navigation crystals)',
  dune:     'Food & Spices (desert spice, preserved rations)',
  granite:  'Ores & Minerals (ancient stone, rare minerals)',
  aether:   'Textiles & Crafts (calm essence, woven charms)',
  terracis: 'Tech & Navigation (clay tablets, void circuits)',
  reverie:  'Botanicals (dream pollen, spore clusters)',
};
