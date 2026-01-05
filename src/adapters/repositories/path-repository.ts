/**
 * PathRepository Adapter
 * JSON 파일을 사용한 학습 경로 저장소 구현
 */

import { App, TFile, TFolder } from 'obsidian';
import { IPathRepository, LearningPath, LearningPathData } from '../../core/domain';

export interface PathRepositoryConfig {
  /**
   * 학습 경로 데이터를 저장할 폴더 경로
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
      storagePath: config?.storagePath ?? '.learning-paths',
    };
  }

  async save(path: LearningPath): Promise<void> {
    await this.ensureStorageFolder();

    const filePath = this.getFilePath(path.id);
    const data = path.toData();
    const content = JSON.stringify(data, null, 2);

    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile && existingFile instanceof TFile) {
      await this.app.vault.modify(existingFile, content);
    } else {
      await this.app.vault.create(filePath, content);
    }
  }

  async findById(id: string): Promise<LearningPath | null> {
    const filePath = this.getFilePath(id);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!file || !(file instanceof TFile)) {
      return null;
    }

    try {
      const content = await this.app.vault.read(file);
      const data = JSON.parse(content) as LearningPathData;
      return LearningPath.fromData(data);
    } catch (error) {
      console.error(`Error reading path file ${filePath}:`, error);
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
   * 저장 폴더 경로 생성
   */
  private getFilePath(id: string): string {
    // ID를 파일명으로 사용 (특수문자 제거)
    const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${this.config.storagePath}/${safeId}.json`;
  }

  /**
   * 저장 폴더가 없으면 생성
   */
  private async ensureStorageFolder(): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(this.config.storagePath);

    if (!folder) {
      await this.app.vault.createFolder(this.config.storagePath);
    }
  }
}
