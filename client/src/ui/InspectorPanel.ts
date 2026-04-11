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
  private missionEl: HTMLElement;
  private thoughtEl: HTMLElement;
  private cargoEl: HTMLElement;
  private cashEl: HTMLElement;
  private dismissBtn: HTMLButtonElement;
  private thoroughBtn: HTMLButtonElement;
  private resultEl: HTMLElement;
  private resultTextEl: HTMLElement;

  private currentAgentId: string | null = null;
  private onDismiss: (agentId: string) => void;
  private onThoroughInspect: (agentId: string) => void;
  private thoroughBtnListener: (() => void) | null = null;

  constructor(
    container: HTMLElement,
    onClose: () => void,
    onThoroughInspect: (agentId: string) => void,
    onDismiss: (agentId: string) => void,
  ) {
    this.onDismiss = onDismiss;
    this.onThoroughInspect = onThoroughInspect;

    this.section = container.querySelector('#inspector-section') as HTMLElement;
    this.nameEl = container.querySelector('#inspector-name') as HTMLElement;
    this.moodEl = container.querySelector('#inspector-mood') as HTMLElement;
    this.personalityEl = container.querySelector('#inspector-personality') as HTMLElement;
    this.missionEl = container.querySelector('#inspector-mission') as HTMLElement;
    this.thoughtEl = container.querySelector('#inspector-thought') as HTMLElement;
    this.cargoEl = container.querySelector('#inspector-cargo') as HTMLElement;
    this.cashEl = container.querySelector('#inspector-cash') as HTMLElement;
    this.dismissBtn = container.querySelector('#inspector-dismiss-btn') as HTMLButtonElement;
    this.thoroughBtn = container.querySelector('#inspector-thorough-btn') as HTMLButtonElement;
    this.resultEl = container.querySelector('#inspector-result') as HTMLElement;
    this.resultTextEl = container.querySelector('#inspector-result-text') as HTMLElement;

    const closeBtn = container.querySelector('#inspector-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => {
      this.hide();
      onClose();
    });

    this.dismissBtn.addEventListener('click', () => {
      if (this.currentAgentId) this.onDismiss(this.currentAgentId);
    });
  }

  private formatLegalInventory(agent: AgentState): string {
    const legalItems = agent.inventory.filter(i => !i.isIllegal);
    if (legalItems.length === 0) return 'empty hold';
    return legalItems.map(i => `${i.quantity}× ${i.name}`).join(', ');
  }

  private formatFullInventory(agent: AgentState): string {
    if (agent.inventory.length === 0) return 'empty hold';
    return agent.inventory
      .map(i => `${i.quantity}× ${i.name}${i.isIllegal ? ' <span style="color:#ff6644;">⚠ ILLEGAL</span>' : ''}`)
      .join(', ');
  }

  show(agent: AgentState): void {
    this.currentAgentId = agent.id;
    this.nameEl.textContent = agent.name;
    this.moodEl.textContent = `${agent.mood} ${MOOD_EMOJI[agent.mood] ?? ''}`;
    this.personalityEl.textContent = agent.personality;
    this.missionEl.textContent = agent.mission ?? '';
    this.thoughtEl.textContent = `"${agent.currentThought}"`;

    // Show legal inventory and cash immediately
    this.cargoEl.textContent = this.formatLegalInventory(agent);
    this.cashEl.textContent = `$${agent.cash}`;

    // Reset result area
    this.resultEl.style.display = 'none';
    this.resultTextEl.innerHTML = '';

    // Show action buttons — wire thorough btn to inspect mode
    this.dismissBtn.style.display = '';
    this.dismissBtn.disabled = false;
    this.thoroughBtn.style.display = '';
    this.thoroughBtn.disabled = false;
    this.thoroughBtn.textContent = 'Thorough Inspect';
    this.setThoroughBtnListener(() => {
      if (this.currentAgentId) this.onThoroughInspect(this.currentAgentId);
    });

    this.section.style.display = 'flex';
  }

  update(agent: AgentState): void {
    if (this.section.style.display !== 'none') {
      this.thoughtEl.textContent = `"${agent.currentThought}"`;
      this.moodEl.textContent = `${agent.mood} ${MOOD_EMOJI[agent.mood] ?? ''}`;
    }
  }

  showMinigameResult(agent: AgentState, won: boolean): void {
    const hasIllegal = agent.inventory.some(i => i.isIllegal);

    // Reveal full inventory
    this.cargoEl.innerHTML = this.formatFullInventory(agent);

    if (won && hasIllegal) {
      this.resultTextEl.innerHTML =
        `<span style="color:#ff6644;font-weight:bold;">CONTRABAND FOUND — AGENT DESTROYED</span>`;
    } else if (won) {
      this.resultTextEl.innerHTML =
        `<span style="color:#aaffaa;font-weight:bold;">Nothing illegal found.</span><br><span style="color:#888888">Agent may continue.</span>`;
    } else {
      // Lost minigame — agent escapes
      this.resultTextEl.innerHTML =
        `<span style="color:#ffaa44;font-weight:bold;">Inspection failed.</span><br><span style="color:#888888">Agent evaded thorough scan.</span>`;
    }

    this.resultEl.style.display = 'block';
    this.dismissBtn.style.display = 'none';
    this.thoroughBtn.disabled = false;
    this.thoroughBtn.textContent = '✓ Done';
    // Swap thorough btn to dismiss mode so clicking Done resumes the agent
    this.setThoroughBtnListener(() => {
      if (this.currentAgentId) this.onDismiss(this.currentAgentId);
    });
  }

  private setThoroughBtnListener(listener: () => void): void {
    if (this.thoroughBtnListener) {
      this.thoroughBtn.removeEventListener('click', this.thoroughBtnListener);
    }
    this.thoroughBtnListener = listener;
    this.thoroughBtn.addEventListener('click', listener);
  }

  hide(): void {
    this.section.style.display = 'none';
    this.currentAgentId = null;
  }
}
