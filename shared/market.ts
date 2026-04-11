// ─── Location-based goods market ─────────────────────────────────────────────
// Each location has separate lists for what it sells (agents can buy) and what
// it buys (agents can sell). No item ever appears in both lists for the same
// location. Items may appear across multiple locations at different prices.

export interface MarketListing {
  itemName: string;
  price: number;
  isIllegal: boolean;
}

export interface LocationMarket {
  sells: MarketListing[];  // items agents can purchase here
  buys:  MarketListing[];  // items agents can sell here
}

export const MARKET: Record<string, LocationMarket> = {
  town_hall: {
    sells: [
      { itemName: 'permits',     price: 18,  isIllegal: false },
    ],
    buys: [
      { itemName: 'coffee',      price: 22,  isIllegal: false },
      { itemName: 'crafts',      price: 15,  isIllegal: false },
      { itemName: 'produce',     price: 18,  isIllegal: false },
      { itemName: 'contraband',  price: 130, isIllegal: true  },
    ],
  },

  cafe: {
    sells: [
      { itemName: 'coffee',      price: 15,  isIllegal: false },
    ],
    buys: [
      { itemName: 'crafts',        price: 18,  isIllegal: false },
      { itemName: 'produce',       price: 20,  isIllegal: false },
      { itemName: 'permits',       price: 24,  isIllegal: false },
      { itemName: 'forged docs',   price: 55,  isIllegal: true  },
      { itemName: 'stolen goods',  price: 85,  isIllegal: true  },
    ],
  },

  park: {
    sells: [
      { itemName: 'crafts',      price: 10,  isIllegal: false },
    ],
    buys: [
      { itemName: 'coffee',      price: 20,  isIllegal: false },
      { itemName: 'produce',     price: 16,  isIllegal: false },
      { itemName: 'electronics', price: 42,  isIllegal: false },
      { itemName: 'contraband',  price: 110, isIllegal: true  },
    ],
  },

  market: {
    sells: [
      { itemName: 'produce',     price: 12,  isIllegal: false },
      { itemName: 'forged docs', price: 8,   isIllegal: true  },
      { itemName: 'contraband',  price: 25,  isIllegal: true  },
    ],
    buys: [
      { itemName: 'permits',       price: 28,  isIllegal: false },
      { itemName: 'electronics',   price: 45,  isIllegal: false },
      { itemName: 'stolen goods',  price: 75,  isIllegal: true  },
    ],
  },

  plaza: {
    sells: [
      { itemName: 'electronics',   price: 35,  isIllegal: false },
      { itemName: 'stolen goods',  price: 20,  isIllegal: true  },
    ],
    buys: [
      { itemName: 'coffee',      price: 25,  isIllegal: false },
      { itemName: 'crafts',      price: 22,  isIllegal: false },
      { itemName: 'permits',     price: 32,  isIllegal: false },
      { itemName: 'forged docs', price: 70,  isIllegal: true  },
    ],
  },
};

/** Items available for agents to purchase at this location. */
export function getSellListings(locationId: string): MarketListing[] {
  return MARKET[locationId]?.sells ?? [];
}

/** What this location will pay to buy an item from an agent. Returns undefined if it doesn't buy that item. */
export function getBuyListing(locationId: string, itemName: string): MarketListing | undefined {
  return MARKET[locationId]?.buys.find(b => b.itemName === itemName);
}

/** All locations that will buy a given item, with their prices. */
export function getBuyersFor(itemName: string): { locationId: string; price: number }[] {
  return Object.entries(MARKET)
    .flatMap(([locationId, market]) => {
      const listing = market.buys.find(b => b.itemName === itemName);
      return listing ? [{ locationId, price: listing.price }] : [];
    })
    .sort((a, b) => b.price - a.price);
}

/** Whether an item is considered illegal (true if flagged anywhere in the market). */
export function isItemIllegal(itemName: string): boolean {
  for (const market of Object.values(MARKET)) {
    const found = [...market.sells, ...market.buys].find(l => l.itemName === itemName);
    if (found) return found.isIllegal;
  }
  return false;
}
