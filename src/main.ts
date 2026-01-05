/**
 * Learning Path Generator - Obsidian Plugin
 *
 * Generate learning paths and curriculum from your vault notes with AI.
 */

import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { DependencyAnalyzer } from './core/domain';
import {
  GenerateLearningPathUseCase,
  UpdateProgressUseCase,
} from './core/application';
import {
  NoteRepository,
  PathRepository,
  ProgressRepository,
  ClaudeLLMProvider,
} from './adapters';
import { LearningPathView, VIEW_TYPE_LEARNING_PATH } from './ui';
import {
  LearningPathSettings,
  LearningPathSettingTab,
  DEFAULT_SETTINGS,
} from './settings';

export default class LearningPathGeneratorPlugin extends Plugin {
  settings!: LearningPathSettings;

  private noteRepository!: NoteRepository;
  private pathRepository!: PathRepository;
  private progressRepository!: ProgressRepository;
  private dependencyAnalyzer!: DependencyAnalyzer;
  private llmProvider?: ClaudeLLMProvider;
  private generatePathUseCase!: GenerateLearningPathUseCase;
  private updateProgressUseCase!: UpdateProgressUseCase;

  async onload(): Promise<void> {
    console.log('Loading Learning Path Generator plugin');

    // Load settings
    await this.loadSettings();

    // Initialize repositories with settings
    this.noteRepository = new NoteRepository(this.app);
    this.pathRepository = new PathRepository(this.app, {
      storagePath: this.settings.storagePath,
    });
    this.progressRepository = new ProgressRepository(this.app, {
      masteryLevelKey: this.settings.masteryLevelKey,
      lastStudiedKey: this.settings.lastStudiedKey,
      studyCountKey: this.settings.studyCountKey,
    });

    // Initialize domain services
    this.dependencyAnalyzer = new DependencyAnalyzer();

    // Initialize LLM provider if API key is configured
    if (this.settings.claudeApiKey) {
      this.llmProvider = new ClaudeLLMProvider({
        apiKey: this.settings.claudeApiKey,
        model: this.settings.claudeModel,
      });
    }

    // Initialize use cases
    this.generatePathUseCase = new GenerateLearningPathUseCase(
      this.noteRepository,
      this.pathRepository,
      this.dependencyAnalyzer,
      this.settings.useLLMAnalysis ? this.llmProvider : undefined
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

    // Add settings tab
    this.addSettingTab(new LearningPathSettingTab(this.app, this));

    // Auto-open view if enabled
    if (this.settings.autoOpenView) {
      this.app.workspace.onLayoutReady(() => {
        this.activateView();
      });
    }
  }

  onunload(): void {
    console.log('Unloading Learning Path Generator plugin');
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_LEARNING_PATH);
  }

  /**
   * 설정 로드
   */
  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * 설정 저장
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Reinitialize repositories with new settings
    this.reinitializeRepositories();
  }

  /**
   * 설정 변경 시 리포지토리 재초기화
   */
  private reinitializeRepositories(): void {
    this.pathRepository = new PathRepository(this.app, {
      storagePath: this.settings.storagePath,
    });
    this.progressRepository = new ProgressRepository(this.app, {
      masteryLevelKey: this.settings.masteryLevelKey,
      lastStudiedKey: this.settings.lastStudiedKey,
      studyCountKey: this.settings.studyCountKey,
    });

    // Reinitialize LLM provider
    if (this.settings.claudeApiKey) {
      this.llmProvider = new ClaudeLLMProvider({
        apiKey: this.settings.claudeApiKey,
        model: this.settings.claudeModel,
      });
    } else {
      this.llmProvider = undefined;
    }

    // Update use cases with new repositories
    this.generatePathUseCase = new GenerateLearningPathUseCase(
      this.noteRepository,
      this.pathRepository,
      this.dependencyAnalyzer,
      this.settings.useLLMAnalysis ? this.llmProvider : undefined
    );
    this.updateProgressUseCase = new UpdateProgressUseCase(
      this.pathRepository,
      this.progressRepository
    );
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
      new Notice('활성화된 노트가 없습니다.');
      return;
    }

    const goalNoteId = activeFile.basename;
    new Notice(`'${goalNoteId}' 학습 경로 생성 중...`);

    try {
      const response = await this.generatePathUseCase.execute({
        name: `${goalNoteId}까지의 학습 경로`,
        goalNoteId,
        excludeFolders: this.settings.excludeFolders,
      });

      if (response.success && response.path) {
        const nodeCount = response.nodes?.length ?? 0;
        new Notice(`학습 경로 생성 완료! ${nodeCount}개 노드`);

        // Show warnings if any
        if (response.warnings && response.warnings.length > 0) {
          new Notice(`경고: ${response.warnings.join(', ')}`, 5000);
        }

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
        new Notice(`학습 경로 생성 실패: ${response.error}`, 5000);
        console.error('Failed to generate path:', response.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      new Notice(`오류 발생: ${message}`, 5000);
      console.error('Error generating path:', error);
    }
  }
}
