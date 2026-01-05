/**
 * Learning Path Generator - Obsidian Plugin
 *
 * Generate learning paths and curriculum from your vault notes with AI.
 */

import { Plugin, WorkspaceLeaf, Notice, TFile, TFolder } from 'obsidian';
import {
  DependencyAnalyzer,
  AIProviderType,
  AI_PROVIDERS,
} from './core/domain';
import {
  GenerateLearningPathUseCase,
  UpdateProgressUseCase,
  AIService,
  initializeAIService,
  destroyAIService,
} from './core/application';
import {
  NoteRepository,
  PathRepository,
  ProgressRepository,
  ClaudeProvider,
  OpenAIProvider,
  GeminiProvider,
  GrokProvider,
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
  private aiService!: AIService;
  private generatePathUseCase!: GenerateLearningPathUseCase;
  private updateProgressUseCase!: UpdateProgressUseCase;

  async onload(): Promise<void> {
    console.log('Loading Learning Path Generator plugin');

    // Load settings
    await this.loadSettings();

    // Migrate storage path if needed (from .learning-paths to _learning-paths)
    await this.migrateStoragePath();

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

    // Initialize AI Service
    this.initializeAIService();

    // Initialize use cases
    this.generatePathUseCase = new GenerateLearningPathUseCase(
      this.noteRepository,
      this.pathRepository,
      this.dependencyAnalyzer,
      this.aiService
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
        pathRepository: this.pathRepository,
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
    destroyAIService();
  }

  /**
   * 설정 로드
   */
  async loadSettings(): Promise<void> {
    const loadedData = await this.loadData();
    this.settings = this.mergeSettings(DEFAULT_SETTINGS, loadedData);
  }

  /**
   * 설정 병합 (기존 설정과 기본값 병합)
   */
  private mergeSettings(defaults: LearningPathSettings, loaded: any): LearningPathSettings {
    if (!loaded) return { ...defaults };

    return {
      ai: {
        provider: loaded.ai?.provider ?? loaded.claudeModel ? 'claude' : defaults.ai.provider,
        apiKeys: loaded.ai?.apiKeys ?? (loaded.claudeApiKey ? { claude: loaded.claudeApiKey } : defaults.ai.apiKeys),
        models: loaded.ai?.models ?? (loaded.claudeModel ? { claude: loaded.claudeModel } : defaults.ai.models),
        enabled: loaded.ai?.enabled ?? loaded.useLLMAnalysis ?? defaults.ai.enabled,
      },
      storagePath: loaded.storagePath ?? defaults.storagePath,
      masteryLevelKey: loaded.masteryLevelKey ?? defaults.masteryLevelKey,
      lastStudiedKey: loaded.lastStudiedKey ?? defaults.lastStudiedKey,
      studyCountKey: loaded.studyCountKey ?? defaults.studyCountKey,
      excludeFolders: loaded.excludeFolders ?? defaults.excludeFolders,
      defaultEstimatedMinutes: loaded.defaultEstimatedMinutes ?? defaults.defaultEstimatedMinutes,
      autoOpenView: loaded.autoOpenView ?? defaults.autoOpenView,
    };
  }

  /**
   * 설정 저장
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Reinitialize services with new settings
    this.reinitializeServices();
  }

  /**
   * 저장 경로 마이그레이션 (.learning-paths → _learning-paths)
   */
  private async migrateStoragePath(): Promise<void> {
    const oldPath = '.learning-paths';
    const newPath = '_learning-paths';

    // Only migrate if still using old path
    if (this.settings.storagePath !== oldPath) {
      return;
    }

    const oldFolder = this.app.vault.getAbstractFileByPath(oldPath);
    if (!oldFolder || !(oldFolder instanceof TFolder)) {
      // Old folder doesn't exist, just update settings
      this.settings.storagePath = newPath;
      await this.saveData(this.settings);
      console.log('[Migration] Updated storagePath to', newPath);
      return;
    }

    // Create new folder if needed
    let newFolder = this.app.vault.getAbstractFileByPath(newPath);
    if (!newFolder) {
      try {
        await this.app.vault.createFolder(newPath);
        console.log('[Migration] Created new folder:', newPath);
      } catch (error) {
        // Ignore "Folder already exists" error
        if (!(error instanceof Error) || !error.message.includes('Folder already exists')) {
          console.error('[Migration] Failed to create folder:', error);
          return;
        }
      }
    }

    // Move files from old folder to new folder
    const filesToMove = oldFolder.children.filter(f => f instanceof TFile);
    for (const file of filesToMove) {
      if (file instanceof TFile) {
        const newFilePath = `${newPath}/${file.name}`;
        try {
          await this.app.vault.rename(file, newFilePath);
          console.log('[Migration] Moved file:', file.path, '→', newFilePath);
        } catch (error) {
          console.error('[Migration] Failed to move file:', file.path, error);
        }
      }
    }

    // Delete old folder if empty
    try {
      const updatedOldFolder = this.app.vault.getAbstractFileByPath(oldPath);
      if (updatedOldFolder instanceof TFolder && updatedOldFolder.children.length === 0) {
        await this.app.vault.delete(updatedOldFolder);
        console.log('[Migration] Deleted old folder:', oldPath);
      }
    } catch (error) {
      console.error('[Migration] Failed to delete old folder:', error);
    }

    // Update settings
    this.settings.storagePath = newPath;
    await this.saveData(this.settings);
    console.log('[Migration] Migration complete. storagePath updated to', newPath);
    new Notice('학습 경로 저장 폴더가 마이그레이션되었습니다.');
  }

  /**
   * AI Service 초기화
   */
  private initializeAIService(): void {
    this.aiService = initializeAIService({
      provider: this.settings.ai.provider,
      apiKeys: this.settings.ai.apiKeys,
      models: this.settings.ai.models,
      enabled: this.settings.ai.enabled,
    });

    // Register all providers
    this.aiService.registerProvider('claude', new ClaudeProvider());
    this.aiService.registerProvider('openai', new OpenAIProvider());
    this.aiService.registerProvider('gemini', new GeminiProvider());
    this.aiService.registerProvider('grok', new GrokProvider());
  }

  /**
   * 설정 변경 시 서비스 재초기화
   */
  private reinitializeServices(): void {
    this.pathRepository = new PathRepository(this.app, {
      storagePath: this.settings.storagePath,
    });
    this.progressRepository = new ProgressRepository(this.app, {
      masteryLevelKey: this.settings.masteryLevelKey,
      lastStudiedKey: this.settings.lastStudiedKey,
      studyCountKey: this.settings.studyCountKey,
    });

    // Update AI Service settings
    this.aiService.updateSettings({
      provider: this.settings.ai.provider,
      apiKeys: this.settings.ai.apiKeys,
      models: this.settings.ai.models,
      enabled: this.settings.ai.enabled,
    });

    // Update use cases with new services
    this.generatePathUseCase = new GenerateLearningPathUseCase(
      this.noteRepository,
      this.pathRepository,
      this.dependencyAnalyzer,
      this.aiService
    );
    this.updateProgressUseCase = new UpdateProgressUseCase(
      this.pathRepository,
      this.progressRepository
    );
  }

  /**
   * API 키 테스트
   */
  async testApiKey(provider: AIProviderType, apiKey: string): Promise<boolean> {
    return this.aiService.testApiKey(provider, apiKey);
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
   * 현재 노트를 목표로 학습 경로 생성 또는 기존 경로 로드
   */
  async generatePathFromCurrentNote(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('활성화된 노트가 없습니다.');
      return;
    }

    const goalNoteId = activeFile.basename;

    try {
      // Check if existing path exists for this goal note
      const existingPath = await this.pathRepository.findByGoalNote(goalNoteId);

      if (existingPath) {
        // Load existing path
        new Notice(`기존 학습 경로를 불러왔습니다: ${goalNoteId}`);
        await this.activateView();

        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_LEARNING_PATH);
        if (leaves.length > 0) {
          const view = leaves[0].view as LearningPathView;
          await view.displayPath(existingPath);
        }
        return;
      }

      // No existing path, generate new one
      new Notice(`'${goalNoteId}' 학습 경로 생성 중...`);

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
