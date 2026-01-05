/**
 * Learning Path Generator - Obsidian Plugin
 *
 * Generate learning paths and curriculum from your vault notes with AI.
 */

import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DependencyAnalyzer } from './core/domain';
import {
  GenerateLearningPathUseCase,
  UpdateProgressUseCase,
} from './core/application';
import {
  NoteRepository,
  PathRepository,
  ProgressRepository,
} from './adapters';
import {
  LearningPathView,
  VIEW_TYPE_LEARNING_PATH,
} from './ui';

export default class LearningPathGeneratorPlugin extends Plugin {
  private noteRepository!: NoteRepository;
  private pathRepository!: PathRepository;
  private progressRepository!: ProgressRepository;
  private dependencyAnalyzer!: DependencyAnalyzer;
  private generatePathUseCase!: GenerateLearningPathUseCase;
  private updateProgressUseCase!: UpdateProgressUseCase;

  async onload(): Promise<void> {
    console.log('Loading Learning Path Generator plugin');

    // Initialize repositories
    this.noteRepository = new NoteRepository(this.app);
    this.pathRepository = new PathRepository(this.app);
    this.progressRepository = new ProgressRepository(this.app);

    // Initialize domain services
    this.dependencyAnalyzer = new DependencyAnalyzer();

    // Initialize use cases
    this.generatePathUseCase = new GenerateLearningPathUseCase(
      this.noteRepository,
      this.pathRepository,
      this.dependencyAnalyzer
    );

    this.updateProgressUseCase = new UpdateProgressUseCase(
      this.pathRepository,
      this.progressRepository
    );

    // Register view
    this.registerView(VIEW_TYPE_LEARNING_PATH, (leaf) => {
      const view = new LearningPathView(leaf);
      view.setDependencies({
        generatePathUseCase: this.generatePathUseCase,
        updateProgressUseCase: this.updateProgressUseCase,
      });
      return view;
    });

    // Add ribbon icon
    this.addRibbonIcon('route', '학습 경로 생성기', () => {
      this.activateView();
    });

    // Add commands
    this.addCommand({
      id: 'open-learning-path-view',
      name: '학습 경로 뷰 열기',
      callback: () => {
        this.activateView();
      },
    });

    this.addCommand({
      id: 'generate-learning-path',
      name: '현재 노트에서 학습 경로 생성',
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          if (!checking) {
            this.generatePathFromCurrentNote();
          }
          return true;
        }
        return false;
      },
    });
  }

  onunload(): void {
    console.log('Unloading Learning Path Generator plugin');
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_LEARNING_PATH);
  }

  /**
   * 학습 경로 뷰 활성화
   */
  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_LEARNING_PATH);

    if (leaves.length > 0) {
      // View already exists, reveal it
      leaf = leaves[0];
    } else {
      // Create new leaf in right sidebar
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_LEARNING_PATH,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  /**
   * 현재 노트를 목표로 학습 경로 생성
   */
  async generatePathFromCurrentNote(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      return;
    }

    const goalNoteId = activeFile.basename;

    const response = await this.generatePathUseCase.execute({
      name: `${goalNoteId}까지의 학습 경로`,
      goalNoteId,
    });

    if (response.success && response.path) {
      // Activate view and display path
      await this.activateView();

      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_LEARNING_PATH);
      if (leaves.length > 0) {
        const view = leaves[0].view as LearningPathView;
        const path = await this.pathRepository.findById(response.path.id);
        if (path) {
          await view.displayPath(path);
        }
      }
    } else {
      console.error('Failed to generate path:', response.error);
    }
  }
}
