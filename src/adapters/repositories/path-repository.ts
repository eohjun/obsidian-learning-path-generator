/**
 * PathRepository Adapter
 * Learning path repository implementation using JSON files
 */

import { App, TFile, TFolder } from 'obsidian';
import { IPathRepository, LearningPath, LearningPathData } from '../../core/domain';

export interface PathRepositoryConfig {
  /**
   * Folder path for storing learning path data
   */
  storagePath: string;
}

export class PathRepository implements IPathRepository {
  private readonly config: PathRepositoryConfig;

  constructor(
    private readonly app: App,
    config?: Partial<PathRepositoryConfig>
  ) {
    this.config = {
      // Use underscore prefix instead of dot (hidden folders may not work well)
      storagePath: config?.storagePath ?? '_learning-paths',
    };
  }

  async save(path: LearningPath): Promise<void> {
    console.log('[PathRepository] save() called with path id:', path.id);

    await this.ensureStorageFolder();

    const filePath = this.getFilePath(path.id);
    const data = path.toData();
    const content = JSON.stringify(data, null, 2);

    console.log('[PathRepository] Saving to:', filePath);

    try {
      const existingFile = this.app.vault.getAbstractFileByPath(filePath);
      if (existingFile && existingFile instanceof TFile) {
        await this.app.vault.modify(existingFile, content);
        console.log('[PathRepository] Modified existing file');
      } else {
        await this.app.vault.create(filePath, content);
        console.log('[PathRepository] Created new file');
      }
    } catch (error) {
      console.error('[PathRepository] Save failed:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<LearningPath | null> {
    const filePath = this.getFilePath(id);
    console.log('[PathRepository] findById() looking for:', filePath);

    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!file || !(file instanceof TFile)) {
      console.log('[PathRepository] File not found:', filePath);
      return null;
    }

    try {
      const content = await this.app.vault.read(file);
      const data = JSON.parse(content) as LearningPathData;
      console.log('[PathRepository] Successfully loaded path');
      return LearningPath.fromData(data);
    } catch (error) {
      console.error(`[PathRepository] Error reading path file ${filePath}:`, error);
      return null;
    }
  }

  async findByGoalNote(goalNoteId: string): Promise<LearningPath | null> {
    const paths = await this.findAll();
    return paths.find((p) => p.goalNoteId === goalNoteId) ?? null;
  }

  async findAll(): Promise<LearningPath[]> {
    await this.ensureStorageFolder();

    const folder = this.app.vault.getAbstractFileByPath(this.config.storagePath);
    if (!folder || !(folder instanceof TFolder)) {
      return [];
    }

    const paths: LearningPath[] = [];

    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'json') {
        try {
          const content = await this.app.vault.read(child);
          const data = JSON.parse(content) as LearningPathData;
          paths.push(LearningPath.fromData(data));
        } catch (error) {
          console.error(`Error reading path file ${child.path}:`, error);
        }
      }
    }

    return paths;
  }

  async delete(id: string): Promise<void> {
    const filePath = this.getFilePath(id);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (file && file instanceof TFile) {
      await this.app.vault.delete(file);
    }
  }

  async exists(id: string): Promise<boolean> {
    const filePath = this.getFilePath(id);
    const file = this.app.vault.getAbstractFileByPath(filePath);
    return file !== null && file instanceof TFile;
  }

  /**
   * Generate storage folder path
   */
  private getFilePath(id: string): string {
    // Use ID as filename (remove special characters)
    const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${this.config.storagePath}/${safeId}.json`;
  }

  /**
   * Create storage folder if it doesn't exist
   */
  private async ensureStorageFolder(): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(this.config.storagePath);

    if (!folder) {
      try {
        await this.app.vault.createFolder(this.config.storagePath);
      } catch (error) {
        // Ignore "Folder already exists" error (race condition or cache issue)
        if (
          !(error instanceof Error) ||
          !error.message.includes('Folder already exists')
        ) {
          throw error;
        }
      }
    }
  }
}
