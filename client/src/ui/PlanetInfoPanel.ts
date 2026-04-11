import { MARKET } from '@shared/market';
import type { PlanetData } from '../map/mapData';
import { itemIconUrl } from './itemIcons';

function marketItemHtml(itemName: string, price: number, isIllegal: boolean, mode: 'sell' | 'buy'): string {
  const iconUrl = itemIconUrl(itemName);
  const priceColor = mode === 'buy' ? '#aaffaa' : '#ffdd88';
  const label = mode === 'buy' ? `buys $${price}` : `$${price}`;
  const border = isIllegal ? '1px solid #ff4422' : '1px solid #334466';
  const bg = isIllegal ? '#2a1010' : '#0d0d22';

  return `
    <div title="${itemName}${isIllegal ? ' ⚠ ILLEGAL' : ''}" style="
      display:inline-flex; flex-direction:column; align-items:center;
      background:${bg}; border:${border}; border-radius:5px;
      padding:4px 5px; gap:2px; position:relative; min-width:50px; max-width:64px;
    ">
      ${isIllegal ? `<span style="position:absolute;top:-5px;right:-4px;font-size:9px;color:#ff4422;line-height:1;">⚠</span>` : ''}
      ${iconUrl
        ? `<img src="${iconUrl}" style="width:24px;height:24px;image-rendering:pixelated;" />`
        : `<span style="font-size:20px;line-height:24px;color:#888;">?</span>`}
      <span style="font-size:8px;color:#bbbbcc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60px;text-align:center;">${itemName}</span>
      <span style="font-size:8px;color:${priceColor};font-weight:bold;">${label}</span>
    </div>
  `.trim();
}

export default class PlanetInfoPanel {
  private section: HTMLElement;
  private content: HTMLElement;
  private visible = false;

  constructor(container: HTMLElement) {
    this.section = container.querySelector('#planet-section') as HTMLElement;
    this.content = container.querySelector('#planet-section-content') as HTMLElement;
  }

  show(planet: PlanetData): void {
    const market = MARKET[planet.id];

    const sellsHtml = (market?.sells ?? [])
      .map(l => marketItemHtml(l.itemName, l.price, l.isIllegal, 'sell'))
      .join('');

    const buysHtml = (market?.buys ?? [])
      .map(l => marketItemHtml(l.itemName, l.price, l.isIllegal, 'buy'))
      .join('');

    const glowHex = '#' + planet.glowColor.toString(16).padStart(6, '0');

    this.content.innerHTML = `
      <!-- Header -->
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
        <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;flex-shrink:0;box-shadow:0 0 10px ${glowHex}99;">
          <img src="planets/${planet.assetKey}.png" style="width:100%;height:100%;object-fit:cover;" />
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:bold;color:#ffdd44;margin-bottom:3px;">${planet.label}</div>
          <div style="font-size:9px;color:#9988bb;line-height:1.4;">${planet.description}</div>
        </div>
        <button id="planet-close" style="background:none;border:1px solid #6644aa;color:#aaa;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px;flex-shrink:0;">✕</button>
      </div>
      <!-- Sells -->
      <div style="font-size:9px;color:#8888cc;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Available here</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px;">
        ${sellsHtml || '<span style="font-size:10px;color:#555577;">nothing for sale</span>'}
      </div>
      <!-- Buys -->
      <div style="font-size:9px;color:#8888cc;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Wanted here</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;">
        ${buysHtml || '<span style="font-size:10px;color:#555577;">nothing wanted</span>'}
      </div>
    `;

    this.section.style.display = 'flex';
    this.visible = true;

    (this.content.querySelector('#planet-close') as HTMLButtonElement)
      ?.addEventListener('click', () => this.hide());
  }

  hide(): void {
    this.section.style.display = 'none';
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }
}
