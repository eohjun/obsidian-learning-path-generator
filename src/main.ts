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
  OpenAIEmbeddingProvider,
  InMemoryVectorStore,
  StandaloneSemanticSearchAdapter,
} from './adapters';
import {
  EmbeddingService,
  initializeEmbeddingService,
  destroyEmbeddingService,
  type EmbeddingProgress,
} from './core/application/services';
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
  private embeddingProvider!: OpenAIEmbeddingProvider;
  private vectorStore!: InMemoryVectorStore;
  private embeddingService!: EmbeddingService;
  private semanticSearchAdapter!: StandaloneSemanticSearchAdapter;
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

    // Initialize Embedding System (standalone, no PKM dependency)
    this.initializeEmbeddingSystem();

    // Initialize use cases
    this.generatePathUseCase = new GenerateLearningPathUseCase(
      this.noteRepository,
      this.pathRepository,
      this.dependencyAnalyzer,
      this.aiService
    );

    // Set semantic search service for concept-based path generation
    this.generatePathUseCase.setSemanticSearchService(this.semanticSearchAdapter);

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
        getMaxDisplayNodes: () => this.settings.maxDisplayNodes,
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

    // Register vault event listeners for auto-embedding
    this.registerVaultEventListeners();

    // Auto-open view if enabled
    if (this.settings.autoOpenView) {
      this.app.workspace.onLayoutReady(() => {
        this.activateView();
      });
    }

    // Initial indexing on startup (if enabled)
    if (this.settings.embedding.indexOnStartup && this.embeddingService.isAvailable()) {
      this.app.workspace.onLayoutReady(() => {
        this.runInitialIndexing();
      });
    }
  }

  onunload(): void {
    console.log('Unloading Learning Path Generator plugin');
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_LEARNING_PATH);
    destroyAIService();
    destroyEmbeddingService();
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
        provider: loaded.ai?.provider ?? (loaded.claudeModel ? 'claude' : defaults.ai.provider),
        apiKeys: loaded.ai?.apiKeys ?? (loaded.claudeApiKey ? { claude: loaded.claudeApiKey } : defaults.ai.apiKeys),
        models: loaded.ai?.models ?? (loaded.claudeModel ? { claude: loaded.claudeModel } : defaults.ai.models),
        enabled: loaded.ai?.enabled ?? (loaded.useLLMAnalysis ?? defaults.ai.enabled),
      },
      embedding: {
        autoEmbed: loaded.embedding?.autoEmbed ?? defaults.embedding.autoEmbed,
        indexOnStartup: loaded.embedding?.indexOnStartup ?? defaults.embedding.indexOnStartup,
        excludeFolders: loaded.embedding?.excludeFolders ?? defaults.embedding.excludeFolders,
      },
      storagePath: loaded.storagePath ?? defaults.storagePath,
      masteryLevelKey: loaded.masteryLevelKey ?? defaults.masteryLevelKey,
      lastStudiedKey: loaded.lastStudiedKey ?? defaults.lastStudiedKey,
      studyCountKey: loaded.studyCountKey ?? defaults.studyCountKey,
      excludeFolders: loaded.excludeFolders ?? defaults.excludeFolders,
      defaultEstimatedMinutes: loaded.defaultEstimatedMinutes ?? defaults.defaultEstimatedMinutes,
      autoOpenView: loaded.autoOpenView ?? defaults.autoOpenView,
      maxDisplayNodes: loaded.maxDisplayNodes ?? defaults.maxDisplayNodes,
    };
  }

  /**
   * 임베딩 통계 조회 (설정 UI용)
   */
  async getEmbeddingStats(): Promise<{ totalNotes: number; embeddedNotes: number; isAvailable: boolean }> {
    const isAvailable = this.embeddingService?.isAvailable() ?? false;
    if (!isAvailable) {
      return { totalNotes: 0, embeddedNotes: 0, isAvailable: false };
    }

    const excludeFolders = this.getEmbeddingExcludeFolders();
    const stats = await this.embeddingService.getStats(excludeFolders);
    return {
      totalNotes: stats.totalNotes,
      embeddedNotes: stats.embeddedNotes,
      isAvailable: true,
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
   * Embedding System 초기화 (Standalone)
   * OpenAI API 키를 사용하여 임베딩 프로바이더 초기화
   */
  private initializeEmbeddingSystem(): void {
    // OpenAI API 키 사용 (기존 설정 재활용)
    const apiKey = this.settings.ai.apiKeys.openai;

    this.embeddingProvider = new OpenAIEmbeddingProvider(apiKey || '');
    this.vectorStore = new InMemoryVectorStore();
    this.embeddingService = initializeEmbeddingService(
      this.embeddingProvider,
      this.vectorStore,
      this.noteRepository
    );
    this.semanticSearchAdapter = new StandaloneSemanticSearchAdapter(
      this.embeddingService
    );

    if (!apiKey) {
      console.warn('[LearningPathGenerator] OpenAI API key not configured. Semantic search will be disabled.');
    } else {
      console.log('[LearningPathGenerator] Embedding system initialized with OpenAI');
    }
  }

  /**
   * Vault 이벤트 리스너 등록 (자동 임베딩)
   */
  private registerVaultEventListeners(): void {
    if (!this.settings.embedding.autoEmbed) {
      console.log('[LearningPathGenerator] Auto-embed disabled');
      return;
    }

    const excludeFolders = this.getEmbeddingExcludeFolders();

    // 노트 생성 시
    this.registerEvent(
      this.app.vault.on('create', async (file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        if (this.isFileInExcludedFolder(file, excludeFolders)) return;
        if (!this.embeddingService.isAvailable()) return;

        console.log(`[LearningPathGenerator] New note: ${file.basename}`);
        await this.embeddingService.embedNote(file.basename);
      })
    );

    // 노트 수정 시
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        if (this.isFileInExcludedFolder(file, excludeFolders)) return;
        if (!this.embeddingService.isAvailable()) return;

        // Debounce: 빠른 연속 수정 시 마지막만 처리
        this.debounceEmbedding(file.basename);
      })
    );

    // 노트 삭제 시
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        this.embeddingService.removeEmbedding(file.basename);
        console.log(`[LearningPathGenerator] Removed embedding: ${file.basename}`);
      })
    );

    // 노트 이름 변경 시
    this.registerEvent(
      this.app.vault.on('rename', async (file, oldPath) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;

        // 이전 임베딩 삭제
        const oldBasename = oldPath.split('/').pop()?.replace('.md', '') || '';
        this.embeddingService.removeEmbedding(oldBasename);

        // 새 임베딩 생성 (제외 폴더가 아닌 경우)
        if (!this.isFileInExcludedFolder(file, excludeFolders) && this.embeddingService.isAvailable()) {
          await this.embeddingService.embedNote(file.basename);
          console.log(`[LearningPathGenerator] Renamed: ${oldBasename} → ${file.basename}`);
        }
      })
    );

    console.log('[LearningPathGenerator] Vault event listeners registered');
  }

  /**
   * 임베딩 제외 폴더 목록 가져오기
   */
  private getEmbeddingExcludeFolders(): string[] {
    return this.settings.embedding.excludeFolders ?? this.settings.excludeFolders;
  }

  /**
   * 파일이 제외 폴더에 있는지 확인
   */
  private isFileInExcludedFolder(file: TFile, excludeFolders: string[]): boolean {
    return excludeFolders.some(folder =>
      file.path.startsWith(folder + '/')
    );
  }

  /**
   * 수정 이벤트 디바운스 (1초)
   */
  private modifyDebounceTimers: Map<string, NodeJS.Timeout> = new Map();

  private debounceEmbedding(noteId: string): void {
    // 기존 타이머 취소
    const existing = this.modifyDebounceTimers.get(noteId);
    if (existing) {
      clearTimeout(existing);
    }

    // 1초 후 임베딩 업데이트
    const timer = setTimeout(async () => {
      this.modifyDebounceTimers.delete(noteId);
      if (this.embeddingService.isAvailable()) {
        await this.embeddingService.embedNote(noteId);
        console.log(`[LearningPathGenerator] Updated embedding: ${noteId}`);
      }
    }, 1000);

    this.modifyDebounceTimers.set(noteId, timer);
  }

  /**
   * 초기 인덱싱 실행
   */
  private async runInitialIndexing(): Promise<void> {
    if (!this.embeddingService.isAvailable()) {
      return;
    }

    const excludeFolders = this.getEmbeddingExcludeFolders();
    const stats = await this.embeddingService.getStats(excludeFolders);

    if (stats.pendingNotes === 0) {
      console.log('[LearningPathGenerator] All notes already indexed');
      return;
    }

    new Notice(`임베딩 인덱싱 시작... (${stats.pendingNotes}개 노트)`);

    const count = await this.embeddingService.indexAllNotes(
      excludeFolders,
      (progress: EmbeddingProgress) => {
        if (progress.phase === 'embedding' && progress.current % 50 === 0) {
          console.log(`[LearningPathGenerator] Indexing progress: ${progress.current}/${progress.total}`);
        }
      }
    );

    new Notice(`임베딩 완료: ${count}개 노트 인덱싱됨`);
    console.log(`[LearningPathGenerator] Initial indexing complete: ${count} notes`);
  }

  /**
   * 수동 리인덱싱 (설정 UI에서 호출)
   */
  async reindexAllNotes(): Promise<number> {
    if (!this.embeddingService.isAvailable()) {
      new Notice('OpenAI API 키가 설정되지 않았습니다.');
      return 0;
    }

    // 기존 임베딩 초기화
    this.embeddingService.clearAllEmbeddings();

    const excludeFolders = this.getEmbeddingExcludeFolders();
    new Notice('전체 노트 리인덱싱 시작...');

    const count = await this.embeddingService.indexAllNotes(
      excludeFolders,
      (progress: EmbeddingProgress) => {
        if (progress.phase === 'complete') {
          new Notice(`리인덱싱 완료: ${progress.total}개 노트`);
        }
      }
    );

    return count;
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

    // Reinitialize Embedding System (API key might have changed)
    destroyEmbeddingService();
    this.initializeEmbeddingSystem();

    // Update use cases with new services
    this.generatePathUseCase = new GenerateLearningPathUseCase(
      this.noteRepository,
      this.pathRepository,
      this.dependencyAnalyzer,
      this.aiService
    );
    this.generatePathUseCase.setSemanticSearchService(this.semanticSearchAdapter);

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

    // Activate view first and clear any existing path
    await this.activateView();
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_LEARNING_PATH);
    if (leaves.length === 0) {
      new Notice('학습 경로 뷰를 열 수 없습니다.');
      return;
    }
    const view = leaves[0].view as LearningPathView;

    // Clear current path in view before loading/generating new one
    await view.clearCurrentPath();

    try {
      // Check if existing path exists for this goal note
      const existingPath = await this.pathRepository.findByGoalNote(goalNoteId);

      if (existingPath) {
        // Load existing path
        await view.displayPath(existingPath);
        new Notice(`기존 학습 경로를 불러왔습니다: ${goalNoteId}`);
        return;
      }

      // No existing path, generate new one
      new Notice(`'${goalNoteId}' 학습 경로 생성 중...`);
      await view.showLoadingState(goalNoteId);

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

        const path = await this.pathRepository.findById(response.path.id);
        if (path) {
          await view.displayPath(path);
        }
      } else {
        await view.showErrorState(response.error || '학습 경로 생성에 실패했습니다.');
        new Notice(`학습 경로 생성 실패: ${response.error}`, 5000);
        console.error('Failed to generate path:', response.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      await view.showErrorState(message);
      new Notice(`오류 발생: ${message}`, 5000);
      console.error('Error generating path:', error);
    }
  }
}
