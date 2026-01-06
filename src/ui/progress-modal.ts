/**
 * Progress Modal
 * Drive Embedder 패턴을 그대로 적용한 진행률 모달
 */

import { Modal, App } from 'obsidian';

export interface ProgressUpdate {
  current: number;
  total: number;
  message: string;
  percentage: number;
}

export class ProgressModal extends Modal {
  private modalTitle: string;

  // Progress UI Elements (Drive Embedder 패턴)
  private progressEl: HTMLElement | null = null;
  private progressFillEl: HTMLElement | null = null;
  private progressStatusEl: HTMLElement | null = null;
  private progressPercentEl: HTMLElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;

  constructor(app: App, title: string) {
    super(app);
    this.modalTitle = title;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('learning-path-progress-modal');

    // Modal Header
    contentEl.createEl('h2', { text: this.modalTitle });

    // Progress Section (Drive Embedder 패턴: 미리 생성)
    this.progressEl = contentEl.createDiv({ cls: 'progress-section' });
    this.showProgress();

    // Close button (initially disabled)
    const buttonContainer = contentEl.createDiv({ cls: 'progress-buttons' });
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.textAlign = 'center';

    this.closeBtn = buttonContainer.createEl('button', { text: '닫기' });
    this.closeBtn.disabled = true;
    this.closeBtn.addEventListener('click', () => this.close());
  }

  /**
   * Drive Embedder의 showProgress() 패턴 복사
   */
  private showProgress(): void {
    if (!this.progressEl) return;

    this.progressEl.empty();

    // Progress container
    const container = this.progressEl.createDiv({ cls: 'progress-container' });
    container.style.marginTop = '15px';

    // Status text
    this.progressStatusEl = container.createEl('p', { text: '준비 중...' });
    this.progressStatusEl.style.marginBottom = '10px';

    // Progress bar
    const progressBar = container.createDiv({ cls: 'progress-bar' });
    progressBar.style.width = '100%';
    progressBar.style.height = '20px';
    progressBar.style.backgroundColor = 'var(--background-modifier-border)';
    progressBar.style.borderRadius = '10px';
    progressBar.style.overflow = 'hidden';

    // Progress fill (왼쪽에서 오른쪽으로)
    this.progressFillEl = progressBar.createDiv({ cls: 'progress-fill' });
    this.progressFillEl.setCssStyles({
      width: '0%',
      height: '100%',
      backgroundColor: 'var(--interactive-accent)',
      transition: 'width 0.3s ease',
      position: 'absolute',
      left: '0',
      top: '0',
    });
    // 부모에 relative 설정
    progressBar.style.position = 'relative';

    // Percentage text
    this.progressPercentEl = container.createEl('p', { text: '0%' });
    this.progressPercentEl.style.textAlign = 'center';
    this.progressPercentEl.style.marginTop = '10px';
  }

  /**
   * Drive Embedder의 updateProgress() 패턴 복사
   */
  updateProgress(progress: ProgressUpdate): void {
    if (!this.progressEl) return;

    if (this.progressFillEl) {
      this.progressFillEl.setCssStyles({ width: `${progress.percentage}%` });
    }

    if (this.progressStatusEl) {
      this.progressStatusEl.textContent = progress.message;
    }

    if (this.progressPercentEl) {
      this.progressPercentEl.textContent = `${progress.current} / ${progress.total} (${progress.percentage}%)`;
    }
  }

  /**
   * 완료 상태
   */
  setComplete(message: string): void {
    if (this.progressStatusEl) {
      this.progressStatusEl.textContent = message;
    }

    if (this.progressFillEl) {
      this.progressFillEl.setCssStyles({
        width: '100%',
        backgroundColor: 'var(--interactive-success)',
      });
    }

    if (this.progressPercentEl) {
      this.progressPercentEl.textContent = '100%';
    }

    if (this.closeBtn) {
      this.closeBtn.disabled = false;
      this.closeBtn.focus();
    }
  }

  /**
   * 에러 상태
   */
  setError(message: string): void {
    if (this.progressStatusEl) {
      this.progressStatusEl.textContent = message;
      this.progressStatusEl.style.color = 'var(--text-error)';
    }

    if (this.progressFillEl) {
      this.progressFillEl.setCssStyles({
        backgroundColor: 'var(--text-error)',
      });
    }

    if (this.closeBtn) {
      this.closeBtn.disabled = false;
      this.closeBtn.focus();
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
