/**
 * Progress Modal
 * Progress modal following Drive Embedder pattern
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

  // Progress UI Elements (Drive Embedder pattern)
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

    // Progress Section (Drive Embedder pattern: pre-created)
    this.progressEl = contentEl.createDiv({ cls: 'progress-section' });
    this.showProgress();

    // Close button (initially disabled)
    const buttonContainer = contentEl.createDiv({ cls: 'progress-buttons' });
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.textAlign = 'center';

    this.closeBtn = buttonContainer.createEl('button', { text: 'Close' });
    this.closeBtn.disabled = true;
    this.closeBtn.addEventListener('click', () => this.close());
  }

  /**
   * Show progress (Drive Embedder showProgress() pattern)
   */
  private showProgress(): void {
    if (!this.progressEl) return;

    this.progressEl.empty();

    // Progress container
    const container = this.progressEl.createDiv({ cls: 'progress-container' });
    container.style.marginTop = '15px';

    // Status text
    this.progressStatusEl = container.createEl('p', { text: 'Preparing...' });
    this.progressStatusEl.style.marginBottom = '10px';

    // Progress bar
    const progressBar = container.createDiv({ cls: 'progress-bar' });
    progressBar.style.width = '100%';
    progressBar.style.height = '20px';
    progressBar.style.backgroundColor = 'var(--background-modifier-border)';
    progressBar.style.borderRadius = '10px';
    progressBar.style.overflow = 'hidden';

    // Progress fill (left to right)
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
    // Set relative position on parent
    progressBar.style.position = 'relative';

    // Percentage text
    this.progressPercentEl = container.createEl('p', { text: '0%' });
    this.progressPercentEl.style.textAlign = 'center';
    this.progressPercentEl.style.marginTop = '10px';
  }

  /**
   * Update progress (Drive Embedder updateProgress() pattern)
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
   * Complete state
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
   * Error state
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
