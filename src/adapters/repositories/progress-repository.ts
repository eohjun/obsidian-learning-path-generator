/**
 * ProgressRepository Adapter
 * Learning progress repository implementation using Frontmatter
 */

import { App, TFile } from 'obsidian';
import { IProgressRepository, MasteryLevel, MasteryLevelValue } from '../../core/domain';
import { generateNoteId } from '../../core/domain/utils/note-id';

export interface ProgressRepositoryConfig {
  /**
   * Frontmatter key for storing mastery level
   */
  masteryLevelKey: string;

  /**
   * Frontmatter key for storing last studied time
   */
  lastStudiedKey: string;

  /**
   * Frontmatter key for storing study count
   */
  studyCountKey: string;
}

export class ProgressRepository implements IProgressRepository {
  private readonly config: ProgressRepositoryConfig;

  constructor(
    private readonly app: App,
    config?: Partial<ProgressRepositoryConfig>
  ) {
    this.config = {
      masteryLevelKey: config?.masteryLevelKey ?? 'learning_mastery',
      lastStudiedKey: config?.lastStudiedKey ?? 'learning_last_studied',
      studyCountKey: config?.studyCountKey ?? 'learning_study_count',
    };
  }

  async getProgress(noteId: string): Promise<MasteryLevel> {
    const file = await this.getFileByNoteId(noteId);
    if (!file) {
      return MasteryLevel.notStarted();
    }

    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;

    if (!frontmatter) {
      return MasteryLevel.notStarted();
    }

    const levelValue = frontmatter[this.config.masteryLevelKey];
    return this.parseLevel(levelValue);
  }

  async updateProgress(noteId: string, level: MasteryLevel): Promise<void> {
    const file = await this.getFileByNoteId(noteId);
    if (!file) {
      console.warn(`Note not found: ${noteId}`);
      return;
    }

    await this.updateFrontmatter(file, {
      [this.config.masteryLevelKey]: level.toString(),
    });
  }

  async getLastStudied(noteId: string): Promise<Date | null> {
    const file = await this.getFileByNoteId(noteId);
    if (!file) {
      return null;
    }

    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;

    if (!frontmatter) {
      return null;
    }

    const lastStudied = frontmatter[this.config.lastStudiedKey];
    if (!lastStudied) {
      return null;
    }

    const date = new Date(lastStudied);
    return isNaN(date.getTime()) ? null : date;
  }

  async updateLastStudied(noteId: string, date: Date): Promise<void> {
    const file = await this.getFileByNoteId(noteId);
    if (!file) {
      console.warn(`Note not found: ${noteId}`);
      return;
    }

    await this.updateFrontmatter(file, {
      [this.config.lastStudiedKey]: this.formatDateTime(date),
    });
  }

  /**
   * Format date as 'yyyy-MM-dd HH:mm:ss'
   */
  private formatDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  async incrementStudyCount(noteId: string): Promise<void> {
    const file = await this.getFileByNoteId(noteId);
    if (!file) {
      console.warn(`Note not found: ${noteId}`);
      return;
    }

    const cache = this.app.metadataCache.getFileCache(file);
    const currentCount = cache?.frontmatter?.[this.config.studyCountKey] ?? 0;
    await this.updateFrontmatter(file, {
      [this.config.studyCountKey]: currentCount + 1,
    });
  }

  async getBulkProgress(noteIds: string[]): Promise<Map<string, MasteryLevel>> {
    const result = new Map<string, MasteryLevel>();

    for (const noteId of noteIds) {
      const level = await this.getProgress(noteId);
      result.set(noteId, level);
    }

    return result;
  }

  async resetProgress(noteId: string): Promise<void> {
    const file = await this.getFileByNoteId(noteId);
    if (!file) {
      return;
    }

    await this.updateFrontmatter(file, {
      [this.config.masteryLevelKey]: MasteryLevelValue.NOT_STARTED,
      [this.config.lastStudiedKey]: null,
      [this.config.studyCountKey]: 0,
    });
  }

  async resetAllProgress(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;

      // Only reset files that have learning progress
      if (frontmatter?.[this.config.masteryLevelKey]) {
        await this.updateFrontmatter(file, {
          [this.config.masteryLevelKey]: MasteryLevelValue.NOT_STARTED,
          [this.config.lastStudiedKey]: null,
          [this.config.studyCountKey]: 0,
        });
      }
    }
  }

  /**
   * Find file by noteId(hash) - Vault Embeddings compatible
   */
  private async getFileByNoteId(noteId: string): Promise<TFile | null> {
    const files = this.app.vault.getMarkdownFiles();
    return files.find((f) => generateNoteId(f.path) === noteId) ?? null;
  }

  /**
   * Parse MasteryLevel from string
   */
  private parseLevel(value: unknown): MasteryLevel {
    if (typeof value !== 'string') {
      return MasteryLevel.notStarted();
    }

    switch (value) {
      case MasteryLevelValue.IN_PROGRESS:
        return MasteryLevel.inProgress();
      case MasteryLevelValue.COMPLETED:
        return MasteryLevel.completed();
      default:
        return MasteryLevel.notStarted();
    }
  }

  /**
   * Update Frontmatter
   */
  private async updateFrontmatter(
    file: TFile,
    updates: Record<string, unknown>
  ): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          delete frontmatter[key];
        } else {
          frontmatter[key] = value;
        }
      }
    });
  }
}
