// Maps game item names to their icon file paths under /items/
// Icons are Kenney Minecraft-style pixel art PNGs

export const ITEM_ICON: Record<string, string> = {
  // Food & Spices
  'ocean pearls':       'items/ocean_pearls.png',
  'tidal salt':         'items/tidal_salt.png',
  'desert spice':       'items/desert_spice.png',
  'preserved rations':  'items/preserved_rations.png',
  // Botanicals
  'medicinal herbs':    'items/medicinal_herbs.png',
  'bloom extract':      'items/bloom_extract.png',
  'dream pollen':       'items/dream_pollen.png',
  'spore clusters':     'items/spore_clusters.png',
  // Ores
  'iron ore':           'items/iron_ore.png',
  'volcanic glass':     'items/volcanic_glass.png',
  'ancient stone':      'items/ancient_stone.png',
  'rare minerals':      'items/rare_minerals.png',
  // Textiles
  'nebula silk':        'items/nebula_silk.png',
  'dyed cloth':         'items/dyed_cloth.png',
  'calm essence':       'items/calm_essence.png',
  'woven charms':       'items/woven_charms.png',
  // Tech
  'cryo shards':        'items/cryo_shards.png',
  'navigation crystals':'items/navigation_crystals.png',
  'clay tablets':       'items/clay_tablets.png',
  'void circuits':      'items/void_circuits.png',
  // Contraband
  'psyche spores':      'items/psyche_spores.png',
  'stolen relics':      'items/stolen_relics.png',
  'dark matter':        'items/dark_matter.png',
};

export function itemIconUrl(itemName: string): string {
  return ITEM_ICON[itemName] ?? '';
}

/** Render a small icon + quantity chip as an HTML string. */
export function itemChipHtml(
  itemName: string,
  quantity: number,
  isIllegal = false,
  showName = true,
): string {
  const iconUrl = itemIconUrl(itemName);
  const border  = isIllegal ? '1px solid #ff4422' : '1px solid #444466';
  const bg      = isIllegal ? '#2a1010' : '#1a1a2e';
  const nameHtml = showName
    ? `<span style="font-size:9px; color:${isIllegal ? '#ff8866' : '#ccccdd'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:64px;">${itemName}</span>`
    : '';

  return `
    <div title="${itemName}${isIllegal ? ' ⚠ ILLEGAL' : ''}" style="
      display:inline-flex; flex-direction:column; align-items:center;
      background:${bg}; border:${border}; border-radius:5px;
      padding:3px 5px; gap:2px; cursor:default; position:relative;
    ">
      ${iconUrl ? `<img src="${iconUrl}" style="width:22px; height:22px; image-rendering:pixelated;" />` : `<span style="font-size:18px; color:#888;">?</span>`}
      <span style="font-size:10px; color:#ffdd44; font-weight:bold; line-height:1;">${quantity}×</span>
      ${nameHtml}
      ${isIllegal ? `<span style="position:absolute; top:-4px; right:-4px; font-size:9px; color:#ff4422;">⚠</span>` : ''}
    </div>
  `.trim();
}
