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
  private dismissBtn: HTMLButtonElement;
  private inspectBtn: HTMLButtonElement;
  private resultEl: HTMLElement;
  private resultTextEl: HTMLElement;

  private currentAgentId: string | null = null;

  constructor(
    container: HTMLElement,
    onClose: () => void,
    onInspect: (agentId: string) => void,
    onDismiss: (agentId: string) => void,
  ) {
    this.section = container.querySelector('#inspector-section') as HTMLElement;
    this.nameEl = container.querySelector('#inspector-name') as HTMLElement;
    this.moodEl = container.querySelector('#inspector-mood') as HTMLElement;
    this.personalityEl = container.querySelector('#inspector-personality') as HTMLElement;
    this.goalEl = container.querySelector('#inspector-goal') as HTMLElement;
    this.thoughtEl = container.querySelector('#inspector-thought') as HTMLElement;
    this.cashEl = container.querySelector('#inspector-cash') as HTMLElement;
    this.dismissBtn = container.querySelector('#inspector-dismiss-btn') as HTMLButtonElement;
    this.inspectBtn = container.querySelector('#inspector-inspect-btn') as HTMLButtonElement;
    this.resultEl = container.querySelector('#inspector-result') as HTMLElement;
    this.resultTextEl = container.querySelector('#inspector-result-text') as HTMLElement;

    const closeBtn = container.querySelector('#inspector-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => {
      this.hide();
      onClose();
    });

    this.dismissBtn.addEventListener('click', () => {
      if (this.currentAgentId) onDismiss(this.currentAgentId);
    });

    this.inspectBtn.addEventListener('click', () => {
      if (this.currentAgentId) onInspect(this.currentAgentId);
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
    this.cashEl.textContent = '';
    this.cashEl.style.display = 'none';

    // Reset investigation state
    this.resultEl.style.display = 'none';
    this.dismissBtn.style.display = '';
    this.dismissBtn.disabled = false;
    this.inspectBtn.disabled = false;
    this.inspectBtn.textContent = '🔍 Investigate';

    this.section.style.display = 'flex';
  }

  update(agent: AgentState): void {
    if (this.section.style.display !== 'none') {
      this.thoughtEl.textContent = `"${agent.currentThought}"`;
      this.goalEl.textContent = agent.currentGoal;
      this.moodEl.textContent = `${agent.mood} ${MOOD_EMOJI[agent.mood] ?? ''}`;
    }
  }

  showInspectResult(agent: AgentState, budgetDelta: number): void {
    const isIllegal = agent.inventory?.isIllegal ?? false;

    // Reveal what they were carrying
    this.cashEl.textContent = `$${agent.cash} · carrying: ${this.formatInventory(agent)}`;
    this.cashEl.style.display = '';

    this.resultTextEl.innerHTML = isIllegal
      ? `<span style="color:#ff6644;font-weight:bold;">ILLEGAL GOODS CONFISCATED</span><br><span style="color:#aaffaa">Goods seized + $${budgetDelta} cash confiscated.</span>`
      : `<span style="color:#aaffaa;font-weight:bold;">Nothing illegal found.</span><br><span style="color:#ff8888">-$${Math.abs(budgetDelta)} budget (false stop).</span>`;

    this.resultEl.style.display = 'block';
    this.dismissBtn.style.display = 'none';
    this.inspectBtn.disabled = true;
    this.inspectBtn.textContent = '✓ Investigated';
  }

  hide(): void {
    this.section.style.display = 'none';
    this.currentAgentId = null;
  }
}
