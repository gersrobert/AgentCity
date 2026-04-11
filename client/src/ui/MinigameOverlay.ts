/**
 * Among Us-style inspection minigame.
 *
 * The player sees a 3×3 grid of colored panels.
 * A sequence of panels lights up one by one.
 * The player must then click the panels in the same order.
 * Sequence length grows each round (2 rounds total).
 * Win → callback(true), Lose → callback(false).
 */

const COLORS = ['#ff4444', '#44aaff', '#44ff88', '#ffdd44', '#ff88ff', '#ff8844', '#aaffff', '#cc44ff', '#88ff44'];
const SEQ_LENGTH = 4;      // panels in the sequence
const SHOW_DELAY  = 600;   // ms each panel stays lit during show phase
const TIME_LIMIT  = 8000;  // ms player has to complete input

export default class MinigameOverlay {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private timerEl: HTMLElement;
  private gridEl: HTMLElement;
  private cells: HTMLElement[] = [];

  private sequence: number[] = [];
  private inputSequence: number[] = [];
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private timeLeft = 0;
  private onDone: ((won: boolean) => void) | null = null;
  private active = false;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 5000;
      font-family: monospace;
      color: #ffffff;
    `;

    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      color: #ffdd44;
      margin-bottom: 12px;
      letter-spacing: 2px;
    `;

    const subTitle = document.createElement('div');
    subTitle.textContent = 'Repeat the sequence';
    subTitle.style.cssText = `font-size: 11px; color: #8888cc; margin-bottom: 20px;`;

    this.timerEl = document.createElement('div');
    this.timerEl.style.cssText = `
      font-size: 14px;
      color: #ff8844;
      margin-bottom: 16px;
      letter-spacing: 1px;
    `;

    this.gridEl = document.createElement('div');
    this.gridEl.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 70px);
      grid-template-rows: repeat(3, 70px);
      gap: 8px;
    `;

    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('button');
      cell.style.cssText = `
        width: 70px;
        height: 70px;
        border-radius: 8px;
        border: 2px solid #333355;
        background: ${COLORS[i]}33;
        cursor: pointer;
        transition: background 0.1s, border-color 0.1s;
        font-size: 0;
      `;
      const idx = i;
      cell.addEventListener('click', () => this.handleCellClick(idx));
      this.cells.push(cell);
      this.gridEl.appendChild(cell);
    }

    this.overlay.appendChild(this.titleEl);
    this.overlay.appendChild(subTitle);
    this.overlay.appendChild(this.timerEl);
    this.overlay.appendChild(this.gridEl);
    document.body.appendChild(this.overlay);
  }

  show(onDone: (won: boolean) => void): void {
    this.onDone = onDone;
    this.active = false;
    this.inputSequence = [];
    this.sequence = this.generateSequence();

    this.overlay.style.display = 'flex';
    this.titleEl.textContent = 'DEEP SCAN INITIATED';

    this.setAllCellsEnabled(false);
    this.playSequence(() => {
      // After showing, player inputs
      this.titleEl.textContent = 'YOUR TURN';
      this.active = true;
      this.setAllCellsEnabled(true);
      this.startTimer();
    });
  }

  private generateSequence(): number[] {
    const seq: number[] = [];
    for (let i = 0; i < SEQ_LENGTH; i++) {
      seq.push(Math.floor(Math.random() * 9));
    }
    return seq;
  }

  private playSequence(onComplete: () => void): void {
    let i = 0;
    const next = () => {
      if (i >= this.sequence.length) {
        onComplete();
        return;
      }
      const idx = this.sequence[i++];
      this.lightCell(idx, true);
      setTimeout(() => {
        this.lightCell(idx, false);
        setTimeout(next, 150);
      }, SHOW_DELAY);
    };
    setTimeout(next, 500);
  }

  private lightCell(idx: number, on: boolean): void {
    const cell = this.cells[idx];
    if (on) {
      cell.style.background = COLORS[idx];
      cell.style.borderColor = '#ffffff';
      cell.style.boxShadow = `0 0 16px ${COLORS[idx]}`;
    } else {
      cell.style.background = `${COLORS[idx]}33`;
      cell.style.borderColor = '#333355';
      cell.style.boxShadow = 'none';
    }
  }

  private handleCellClick(idx: number): void {
    if (!this.active) return;
    this.inputSequence.push(idx);
    this.lightCell(idx, true);
    setTimeout(() => this.lightCell(idx, false), 200);

    const pos = this.inputSequence.length - 1;
    if (this.inputSequence[pos] !== this.sequence[pos]) {
      // Wrong input
      this.finish(false);
      return;
    }
    if (this.inputSequence.length === this.sequence.length) {
      // Completed correctly
      this.finish(true);
    }
  }

  private startTimer(): void {
    this.timeLeft = TIME_LIMIT;
    this.timerEl.textContent = `Time: ${(this.timeLeft / 1000).toFixed(1)}s`;
    this.timerInterval = setInterval(() => {
      this.timeLeft -= 100;
      this.timerEl.textContent = `Time: ${(this.timeLeft / 1000).toFixed(1)}s`;
      if (this.timeLeft <= 0) {
        this.finish(false);
      }
    }, 100);
  }

  private finish(won: boolean): void {
    if (!this.active) return;
    this.active = false;
    this.setAllCellsEnabled(false);
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Flash result color
    this.titleEl.textContent = won ? '✓ SCAN COMPLETE' : '✗ SCAN FAILED';
    this.titleEl.style.color = won ? '#aaffaa' : '#ff4444';
    this.timerEl.textContent = '';

    setTimeout(() => {
      this.overlay.style.display = 'none';
      this.titleEl.style.color = '#ffdd44';
      if (this.onDone) this.onDone(won);
      this.onDone = null;
    }, 900);
  }

  private setAllCellsEnabled(enabled: boolean): void {
    for (const cell of this.cells) {
      (cell as HTMLButtonElement).disabled = !enabled;
      cell.style.cursor = enabled ? 'pointer' : 'default';
    }
  }
}
