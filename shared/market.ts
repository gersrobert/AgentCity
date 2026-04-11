// ─── Inter-planetary goods market ────────────────────────────────────────────
// Each planet has items it sells (agents can buy) and items it accepts from agents.
// No item appears in both lists for the same planet.

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
  aquaria: {
    sells: [
      { itemName: 'tidal crystals',    price: 18, isIllegal: false },
    ],
    buys: [
      { itemName: 'star spice',        price: 28, isIllegal: false },
      { itemName: 'void dust',         price: 22, isIllegal: false },
      { itemName: 'dark matter',       price: 140, isIllegal: true },
    ],
  },

  ember: {
    sells: [
      { itemName: 'magma ore',         price: 14, isIllegal: false },
    ],
    buys: [
      { itemName: 'tidal crystals',    price: 26, isIllegal: false },
      { itemName: 'nebula silk',       price: 32, isIllegal: false },
      { itemName: 'stolen relics',     price: 90, isIllegal: true },
    ],
  },

  verdant: {
    sells: [
      { itemName: 'star spice',        price: 12, isIllegal: false },
    ],
    buys: [
      { itemName: 'magma ore',         price: 22, isIllegal: false },
      { itemName: 'void dust',         price: 18, isIllegal: false },
      { itemName: 'dark matter',       price: 120, isIllegal: true },
    ],
  },

  dune: {
    sells: [
      { itemName: 'void dust',         price: 10, isIllegal: false },
      { itemName: 'contraband spores', price: 22, isIllegal: true },
    ],
    buys: [
      { itemName: 'tidal crystals',    price: 30, isIllegal: false },
      { itemName: 'magma ore',         price: 20, isIllegal: false },
      { itemName: 'stolen relics',     price: 80, isIllegal: true },
    ],
  },

  nebula: {
    sells: [
      { itemName: 'nebula silk',       price: 20, isIllegal: false },
    ],
    buys: [
      { itemName: 'star spice',        price: 22, isIllegal: false },
      { itemName: 'void dust',         price: 25, isIllegal: false },
      { itemName: 'contraband spores', price: 100, isIllegal: true },
    ],
  },

  frost: {
    sells: [
      { itemName: 'cryo shards',       price: 16, isIllegal: false },
    ],
    buys: [
      { itemName: 'magma ore',         price: 28, isIllegal: false },
      { itemName: 'nebula silk',       price: 34, isIllegal: false },
      { itemName: 'dark matter',       price: 130, isIllegal: true },
    ],
  },

  terracis: {
    sells: [
      { itemName: 'clay tablets',      price: 11, isIllegal: false },
    ],
    buys: [
      { itemName: 'cryo shards',       price: 24, isIllegal: false },
      { itemName: 'tidal crystals',    price: 22, isIllegal: false },
      { itemName: 'stolen relics',     price: 95, isIllegal: true },
    ],
  },

  aether: {
    sells: [
      { itemName: 'calm essence',      price: 25, isIllegal: false },
    ],
    buys: [
      { itemName: 'clay tablets',      price: 20, isIllegal: false },
      { itemName: 'star spice',        price: 30, isIllegal: false },
      { itemName: 'contraband spores', price: 110, isIllegal: true },
    ],
  },

  reverie: {
    sells: [
      { itemName: 'dream pollen',      price: 14, isIllegal: false },
      { itemName: 'stolen relics',     price: 18, isIllegal: true },
    ],
    buys: [
      { itemName: 'calm essence',      price: 38, isIllegal: false },
      { itemName: 'cryo shards',       price: 28, isIllegal: false },
      { itemName: 'dark matter',       price: 150, isIllegal: true },
    ],
  },

  granite: {
    sells: [
      { itemName: 'ancient stone',     price: 13, isIllegal: false },
    ],
    buys: [
      { itemName: 'dream pollen',      price: 25, isIllegal: false },
      { itemName: 'nebula silk',       price: 38, isIllegal: false },
      { itemName: 'void dust',         price: 20, isIllegal: false },
      { itemName: 'contraband spores', price: 120, isIllegal: true },
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
