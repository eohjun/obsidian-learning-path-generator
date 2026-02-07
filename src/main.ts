/**
 * Learning Path Generator - Obsidian Plugin
 *
 * Generate learning paths and curriculum from your vault notes with AI.
 * Semantic search uses embeddings from Vault Embeddings plugin.
 */

import { Plugin, WorkspaceLeaf, Notice, TFile, TFolder } from 'obsidian';
import {
  DependencyAnalyzer,
  AIProviderType,
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
  VaultEmbeddingsVectorStore,
  StandaloneSemanticSearchAdapter,
} from './adapters';
import {
  EmbeddingService,
  initializeEmbeddingService,
  destroyEmbeddingService,
} from './core/application/services';
import { LearningPathView, VIEW_TYPE_LEARNING_PATH } from './ui';
import {
  LearningPathSettings,
  LearningPathSettingTab,
  DEFAULT_SETTINGS,
} from './settings';
import { generateNoteId } from './core/domain/utils/note-id';

export default class LearningPathGeneratorPlugin extends Plugin {
  settings!: LearningPathSettings;

  private noteRepository!: NoteRepository;
  private pathRepository!: PathRepository;
  private progressRepository!: ProgressRepository;
  private dependencyAnalyzer!: DependencyAnalyzer;
  private aiService!: AIService;
  private embeddingProvider!: OpenAIEmbeddingProvider;
  private vectorStore!: VaultEmbeddingsVectorStore;
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

    // Initialize Embedding System (reads from Vault Embeddings)
    await this.initializeEmbeddingSystem();

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
    this.addRibbonIcon('route', 'Learning Path Generator', () => {
      this.activateView();
    });

    // Add commands
    this.addCommand({
      id: 'open-learning-path-view',
      name: 'Open Learning Path View',
      callback: () => {
        this.activateView();
      },
    });

    this.addCommand({
      id: 'generate-learning-path',
      name: 'Generate Learning Path from Current Note',
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

    this.addCommand({
      id: 'refresh-embeddings',
      name: 'Refresh Embeddings Cache (Vault Embeddings)',
      callback: async () => {
        await this.refreshEmbeddings();
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
    destroyEmbeddingService();
  }

  /**
   * Load settings
   */
  async loadSettings(): Promise<void> {
    const loadedData = await this.loadData();
    this.settings = this.mergeSettings(DEFAULT_SETTINGS, loadedData);
  }

  /**
   * Merge settings (merge existing settings with defaults)
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
        openaiApiKey: loaded.embedding?.openaiApiKey ?? defaults.embedding.openaiApiKey,
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
   * Get embedding statistics (for settings UI)
   */
  async getEmbeddingStats(): Promise<{ totalEmbeddings: number; provider: string; model: string; isAvailable: boolean }> {
    const isAvailable = this.embeddingService?.isAvailable() ?? false;
    if (!isAvailable) {
      return { totalEmbeddings: 0, provider: 'N/A', model: 'N/A', isAvailable: false };
    }

    const stats = await this.vectorStore.getStats();
    return {
      totalEmbeddings: stats.totalEmbeddings,
      provider: stats.provider,
      model: stats.model,
      isAvailable: true,
    };
  }

  /**
   * Save settings
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Reinitialize services with new settings
    await this.reinitializeServices();
  }

  /**
   * Migrate storage path (.learning-paths -> _learning-paths)
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
          console.log('[Migration] Moved file:', file.path, '->', newFilePath);
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
    new Notice('Learning path storage folder has been migrated.');
  }

  /**
   * Initialize AI Service
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
   * Initialize Embedding System
   *
   * Note embeddings: Read from Vault Embeddings plugin
   * Query embeddings: Generate via OpenAI API
   */
  private async initializeEmbeddingSystem(): Promise<void> {
    // OpenAI API key (for query embeddings)
    const apiKey = this.settings.embedding.openaiApiKey || this.settings.ai.apiKeys.openai;

    // Query embedding provider (OpenAI)
    this.embeddingProvider = new OpenAIEmbeddingProvider(apiKey || '');

    // Read note embeddings from Vault Embeddings
    this.vectorStore = new VaultEmbeddingsVectorStore(this.app, {
      storagePath: '09_Embedded',
      embeddingsFolder: 'embeddings',
    });
    await this.vectorStore.initialize();

    // Initialize embedding service (query embeddings + search)
    this.embeddingService = initializeEmbeddingService(
      this.embeddingProvider,
      this.vectorStore
    );

    // Semantic search adapter
    this.semanticSearchAdapter = new StandaloneSemanticSearchAdapter(
      this.embeddingService
    );

    if (!apiKey) {
      console.warn('[LearningPathGenerator] OpenAI API key not configured. Semantic search queries will fail.');
      new Notice('Learning Path Generator: API key not configured. Set it in Settings for AI-powered paths.');
    } else {
      const stats = await this.vectorStore.getStats();
      console.log(`[LearningPathGenerator] Embedding system initialized: ${stats.totalEmbeddings} embeddings from Vault Embeddings`);
    }
  }

  /**
   * Refresh embeddings cache
   */
  private async refreshEmbeddings(): Promise<void> {
    try {
      await this.vectorStore.refresh();
      const stats = await this.vectorStore.getStats();
      new Notice(`Embeddings refreshed: ${stats.totalEmbeddings} items`);
    } catch (error) {
      console.error('[LearningPathGenerator] Failed to refresh embeddings:', error);
      new Notice('Failed to refresh embeddings');
    }
  }

  /**
   * Reinitialize services when settings change
   */
  private async reinitializeServices(): Promise<void> {
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
    await this.initializeEmbeddingSystem();

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
   * Test API key
   */
  async testApiKey(provider: AIProviderType, apiKey: string): Promise<boolean> {
    return this.aiService.testApiKey(provider, apiKey);
  }

  /**
   * Activate learning path view
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
   * Generate learning path from current note or load existing path
   */
  async generatePathFromCurrentNote(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active note.');
      return;
    }

    // Hash-based ID for Vault Embeddings compatibility
    const goalNoteId = generateNoteId(activeFile.path);
    const goalNoteName = activeFile.basename;

    // Activate view first and clear any existing path
    await this.activateView();
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_LEARNING_PATH);
    if (leaves.length === 0) {
      new Notice('Cannot open learning path view.');
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
        new Notice(`Loaded existing learning path: ${goalNoteName}`);
        return;
      }

      // No existing path, generate new one
      new Notice(`Generating learning path for '${goalNoteName}'...`);
      await view.showLoadingState(goalNoteName);

      const response = await this.generatePathUseCase.execute({
        name: `Learning path to ${goalNoteName}`,
        goalNoteId,
        excludeFolders: this.settings.excludeFolders,
      });

      if (response.success && response.path) {
        const nodeCount = response.nodes?.length ?? 0;
        new Notice(`Learning path generated! ${nodeCount} nodes`);

        // Show warnings if any
        if (response.warnings && response.warnings.length > 0) {
          new Notice(`Warning: ${response.warnings.join(', ')}`, 5000);
        }

        const path = await this.pathRepository.findById(response.path.id);
        if (path) {
          await view.displayPath(path);
        }
      } else {
        await view.showErrorState(response.error || 'Failed to generate learning path.');
        new Notice(`Failed to generate learning path: ${response.error}`, 5000);
        console.error('Failed to generate path:', response.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await view.showErrorState(message);
      new Notice(`Error: ${message}`, 5000);
      console.error('Error generating path:', error);
    }
  }
}
