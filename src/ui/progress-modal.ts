/**
 * Progress Modal
 * 작업 진행 상황을 표시하는 모달
 */

import { App, Modal } from 'obsidian';

export class ProgressModal extends Modal {
  private messageEl!: HTMLElement;
  private progressBarFill!: HTMLElement;
  private progressText!: HTMLElement;
  private closeButton!: HTMLButtonElement;
  private modalTitle: string;

  constructor(app: App, title: string) {
    super(app);
    this.modalTitle = title;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('progress-modal');

    // 타이틀
    contentEl.createEl('h2', { text: this.modalTitle });

    // 메시지
    this.messageEl = contentEl.createEl('p', { text: '준비 중...' });
    this.messageEl.style.marginBottom = '15px';

    // Progress bar 컨테이너
    const progressContainer = contentEl.createDiv({ cls: 'progress-bar-container' });
    progressContainer.style.width = '100%';
    progressContainer.style.height = '20px';
    progressContainer.style.backgroundColor = 'var(--background-modifier-border)';
    progressContainer.style.borderRadius = '10px';
    progressContainer.style.overflow = 'hidden';
    progressContainer.style.marginBottom = '10px';

    // Progress bar fill
    this.progressBarFill = progressContainer.createDiv({ cls: 'progress-bar-fill' });
    this.progressBarFill.style.width = '0%';
    this.progressBarFill.style.height = '100%';
    this.progressBarFill.style.backgroundColor = 'var(--interactive-accent)';
    this.progressBarFill.style.transition = 'width 0.3s ease';

    // Progress 텍스트
    this.progressText = contentEl.createEl('p', { text: '0%' });
    this.progressText.style.textAlign = 'center';
    this.progressText.style.marginBottom = '15px';

    // 닫기 버튼 (완료 후에만 활성화)
    this.closeButton = contentEl.createEl('button', { text: '닫기' });
    this.closeButton.style.width = '100%';
    this.closeButton.disabled = true;
    this.closeButton.onclick = () => this.close();
  }

  /**
   * 진행 상황 업데이트
   */
  updateProgress(current: number, total: number, message?: string): void {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    this.progressBarFill.style.width = `${percentage}%`;
    this.progressText.setText(`${current} / ${total} (${percentage}%)`);

    if (message) {
      this.messageEl.setText(message);
    }
  }

  /**
   * 완료 상태로 변경
   */
  setComplete(message: string): void {
    this.messageEl.setText(message);
    this.progressBarFill.style.width = '100%';
    this.progressBarFill.style.backgroundColor = 'var(--interactive-success)';
    this.closeButton.disabled = false;
    this.closeButton.focus();
  }

  /**
   * 에러 상태로 변경
   */
  setError(message: string): void {
    this.messageEl.setText(message);
    this.messageEl.style.color = 'var(--text-error)';
    this.progressBarFill.style.backgroundColor = 'var(--text-error)';
    this.closeButton.disabled = false;
    this.closeButton.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
