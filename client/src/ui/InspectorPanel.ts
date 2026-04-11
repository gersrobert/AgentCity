import type { AgentState, Mood } from '@shared/types';

const MOOD_EMOJI: Record<Mood, string> = {
  happy: ':)',
  excited: ':D',
  curious: ':o',
  content: ':-)',
  bored: ':|',
  anxious: ':S',
  sad: ':(',
  angry: '>:(',
};

export default class InspectorPanel {
  private section: HTMLElement;
  private nameEl: HTMLElement;
  private moodEl: HTMLElement;
  private personalityEl: HTMLElement;
  private goalEl: HTMLElement;
  private thoughtEl: HTMLElement;
  private cashEl: HTMLElement;
  private inspectBtn: HTMLButtonElement;
  private resultEl: HTMLElement;
  private resultTextEl: HTMLElement;
  private tradeLogEl: HTMLElement;
  private tradeEntriesEl: HTMLElement;

  private currentAgentId: string | null = null;

  constructor(container: HTMLElement, onClose: () => void, onInspect: (agentId: string) => void) {
    this.section = container.querySelector('#inspector-section') as HTMLElement;
    this.nameEl = container.querySelector('#inspector-name') as HTMLElement;
    this.moodEl = container.querySelector('#inspector-mood') as HTMLElement;
    this.personalityEl = container.querySelector('#inspector-personality') as HTMLElement;
    this.goalEl = container.querySelector('#inspector-goal') as HTMLElement;
    this.thoughtEl = container.querySelector('#inspector-thought') as HTMLElement;
    this.cashEl = container.querySelector('#inspector-cash') as HTMLElement;
    this.inspectBtn = container.querySelector('#inspector-inspect-btn') as HTMLButtonElement;
    this.resultEl = container.querySelector('#inspector-result') as HTMLElement;
    this.resultTextEl = container.querySelector('#inspector-result-text') as HTMLElement;
    this.tradeLogEl = container.querySelector('#inspector-trade-log') as HTMLElement;
    this.tradeEntriesEl = container.querySelector('#inspector-trade-entries') as HTMLElement;

    const closeBtn = container.querySelector('#inspector-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => {
      this.hide();
      onClose();
    });

    this.inspectBtn.addEventListener('click', () => {
      if (this.currentAgentId) {
        onInspect(this.currentAgentId);
      }
    });
  }

  private formatInventory(agent: AgentState): string {
    if (!agent.inventory) return 'empty';
    const flag = agent.inventory.isIllegal ? ' ⚠' : '';
    return `${agent.inventory.quantity}x ${agent.inventory.name}${flag}`;
  }

  show(agent: AgentState): void {
    this.currentAgentId = agent.id;
    this.nameEl.textContent = agent.name;
    this.moodEl.textContent = `${agent.mood} ${MOOD_EMOJI[agent.mood] ?? ''}`;
    this.personalityEl.textContent = agent.personality;
    this.goalEl.textContent = agent.currentGoal;
    this.thoughtEl.textContent = `"${agent.currentThought}"`;
    this.cashEl.textContent = `$${agent.cash} · carrying: ${this.formatInventory(agent)}`;

    // Reset investigation state
    this.resultEl.style.display = 'none';
    this.tradeLogEl.style.display = 'none';
    this.inspectBtn.disabled = false;
    this.inspectBtn.textContent = '🔍 Inspect';

    this.section.style.display = 'flex';
  }

  update(agent: AgentState): void {
    if (this.section.style.display !== 'none') {
      this.thoughtEl.textContent = `"${agent.currentThought}"`;
      this.goalEl.textContent = agent.currentGoal;
      this.moodEl.textContent = `${agent.mood} ${MOOD_EMOJI[agent.mood] ?? ''}`;
      this.cashEl.textContent = `$${agent.cash} · carrying: ${this.formatInventory(agent)}`;
    }
  }

  showInspectResult(agent: AgentState, budgetDelta: number): void {
    const illegalTrades = agent.tradeHistory.filter(r => r.isIllegal).length;
    const isIllegal = illegalTrades > 0 || (agent.inventory?.isIllegal ?? false);

    this.resultTextEl.innerHTML = isIllegal
      ? `<span style="color:#ff6644;font-weight:bold;">ILLEGAL TRADER CONFIRMED</span><br><span style="color:#aaffaa">+$${budgetDelta} budget awarded.</span>`
      : `<span style="color:#aaffaa;font-weight:bold;">Clean record. No violations found.</span><br><span style="color:#ff8888">-$${Math.abs(budgetDelta)} budget (false arrest).</span>`;

    this.resultEl.style.display = 'block';

    const entries = agent.tradeHistory.slice(-5).reverse();
    this.tradeEntriesEl.innerHTML = entries.length > 0
      ? entries.map(r => {
          const t = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const flag = r.isIllegal ? ' <span style="color:#ff8844">⚠</span>' : '';
          return `${t} — ${r.quantity}x ${r.goods}${flag} @ ${r.locationId} <span style="color:#aaffaa">+$${r.profit}</span>`;
        }).join('<br>')
      : 'No trades recorded yet.';

    this.tradeLogEl.style.display = 'block';
    this.inspectBtn.disabled = true;
    this.inspectBtn.textContent = '✓ Investigated';
  }

  hide(): void {
    this.section.style.display = 'none';
    this.currentAgentId = null;
  }
}
