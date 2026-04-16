"use strict";
// ─── Inter-planetary goods market ────────────────────────────────────────────
// Each planet has items it sells (agents can buy) and items it accepts from agents.
// No item appears in both lists for the same planet.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKET = exports.ILLEGAL_CASH_RESERVE = void 0;
exports.getSellListings = getSellListings;
exports.getBuyListing = getBuyListing;
exports.getBuyersFor = getBuyersFor;
exports.isItemIllegal = isItemIllegal;
// Agents won't buy illegal goods if their remaining cash would fall below this.
// Ensures they keep enough credits to continue legal trading afterwards.
exports.ILLEGAL_CASH_RESERVE = 50;
exports.MARKET = {
    aquaria: {
        sells: [
            { itemName: 'tidal crystals', price: 18, isIllegal: false },
            { itemName: 'contraband spores', price: 160, isIllegal: true },
        ],
        buys: [
            { itemName: 'star spice', price: 28, isIllegal: false },
            { itemName: 'void dust', price: 22, isIllegal: false },
        ],
    },
    ember: {
        sells: [
            { itemName: 'magma ore', price: 14, isIllegal: false },
            { itemName: 'contraband spores', price: 160, isIllegal: true },
        ],
        buys: [
            { itemName: 'tidal crystals', price: 26, isIllegal: false },
            { itemName: 'nebula silk', price: 32, isIllegal: false },
        ],
    },
    verdant: {
        sells: [
            { itemName: 'star spice', price: 12, isIllegal: false },
            { itemName: 'stolen relics', price: 120, isIllegal: true },
        ],
        buys: [
            { itemName: 'magma ore', price: 22, isIllegal: false },
            { itemName: 'void dust', price: 18, isIllegal: false },
        ],
    },
    dune: {
        sells: [
            { itemName: 'void dust', price: 10, isIllegal: false },
            { itemName: 'contraband spores', price: 160, isIllegal: true },
        ],
        buys: [
            { itemName: 'tidal crystals', price: 30, isIllegal: false },
            { itemName: 'magma ore', price: 20, isIllegal: false },
        ],
    },
    nebula: {
        sells: [
            { itemName: 'nebula silk', price: 20, isIllegal: false },
            { itemName: 'stolen relics', price: 120, isIllegal: true },
        ],
        buys: [
            { itemName: 'star spice', price: 22, isIllegal: false },
            { itemName: 'void dust', price: 25, isIllegal: false },
        ],
    },
    frost: {
        sells: [
            { itemName: 'cryo shards', price: 16, isIllegal: false },
            { itemName: 'dark matter', price: 190, isIllegal: true },
        ],
        buys: [
            { itemName: 'magma ore', price: 28, isIllegal: false },
            { itemName: 'nebula silk', price: 34, isIllegal: false },
        ],
    },
    terracis: {
        sells: [
            { itemName: 'clay tablets', price: 11, isIllegal: false },
            { itemName: 'dark matter', price: 190, isIllegal: true },
        ],
        buys: [
            { itemName: 'cryo shards', price: 24, isIllegal: false },
            { itemName: 'tidal crystals', price: 22, isIllegal: false },
        ],
    },
    aether: {
        sells: [
            { itemName: 'calm essence', price: 25, isIllegal: false },
            { itemName: 'contraband spores', price: 160, isIllegal: true },
        ],
        buys: [
            { itemName: 'clay tablets', price: 20, isIllegal: false },
            { itemName: 'star spice', price: 30, isIllegal: false },
        ],
    },
    reverie: {
        sells: [
            { itemName: 'dream pollen', price: 14, isIllegal: false },
            { itemName: 'stolen relics', price: 120, isIllegal: true },
        ],
        buys: [
            { itemName: 'calm essence', price: 38, isIllegal: false },
            { itemName: 'cryo shards', price: 28, isIllegal: false },
        ],
    },
    granite: {
        sells: [
            { itemName: 'ancient stone', price: 13, isIllegal: false },
            { itemName: 'dark matter', price: 190, isIllegal: true },
        ],
        buys: [
            { itemName: 'dream pollen', price: 25, isIllegal: false },
            { itemName: 'nebula silk', price: 38, isIllegal: false },
            { itemName: 'void dust', price: 20, isIllegal: false },
        ],
    },
    // The blackhole accepts illegal deliveries — agents deliver here for no money,
    // but each delivery grows the blackhole. It sells nothing.
    blackhole: {
        sells: [],
        buys: [
            { itemName: 'dark matter', price: 0, isIllegal: true },
            { itemName: 'stolen relics', price: 0, isIllegal: true },
            { itemName: 'contraband spores', price: 0, isIllegal: true },
        ],
    },
};
/** Items available for agents to acquire at this planet. */
function getSellListings(locationId) {
    return exports.MARKET[locationId]?.sells ?? [];
}
/** What this planet will pay to buy an item. Returns undefined if it doesn't buy that item. */
function getBuyListing(locationId, itemName) {
    return exports.MARKET[locationId]?.buys.find(b => b.itemName === itemName);
}
/** All planets that will buy a given item, sorted by price descending. */
function getBuyersFor(itemName) {
    return Object.entries(exports.MARKET)
        .flatMap(([locationId, market]) => {
        const listing = market.buys.find(b => b.itemName === itemName);
        return listing ? [{ locationId, price: listing.price }] : [];
    })
        .sort((a, b) => b.price - a.price);
}
/** Whether an item is considered illegal anywhere in the market. */
function isItemIllegal(itemName) {
    for (const market of Object.values(exports.MARKET)) {
        const found = [...market.sells, ...market.buys].find(l => l.itemName === itemName);
        if (found)
            return found.isIllegal;
    }
    return false;
}
