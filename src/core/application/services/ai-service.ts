/**
 * AI Service
 * LLM Provider 관리 및 싱글톤 서비스
 */

import {
  ILLMProvider,
  LLMMessage,
  LLMGenerateOptions,
  LLMResponse,
  AIProviderType,
  AI_PROVIDERS,
  DependencyAnalysisResult,
  KnowledgeGapAnalysisResult,
  LearningPathAnalysisResult,
  DependencyRelation,
} from '../../domain';

export interface AISettings {
  provider: AIProviderType;
  apiKeys: Partial<Record<AIProviderType, string>>;
  models: Partial<Record<AIProviderType, string>>;
  enabled: boolean;
}

export class AIService {
  private providers: Map<AIProviderType, ILLMProvider> = new Map();
  private settings: AISettings;

  constructor(settings: AISettings) {
    this.settings = settings;
  }

  registerProvider(type: AIProviderType, provider: ILLMProvider): void {
    this.providers.set(type, provider);

    // Apply settings to provider
    const apiKey = this.settings.apiKeys[type];
    if (apiKey) {
      provider.setApiKey(apiKey);
    }

    const providerConfig = AI_PROVIDERS[type as keyof typeof AI_PROVIDERS];
    const model = this.settings.models[type] || providerConfig.defaultModel;
    provider.setModel(model);
  }

  getProvider(type: AIProviderType): ILLMProvider | undefined {
    return this.providers.get(type);
  }

  getCurrentProvider(): ILLMProvider | undefined {
    return this.providers.get(this.settings.provider);
  }

  updateSettings(settings: AISettings): void {
    this.settings = settings;

    // Update all registered providers
    for (const [type, provider] of this.providers) {
      const apiKey = this.settings.apiKeys[type];
      if (apiKey) {
        provider.setApiKey(apiKey);
      }

      const providerConfig = AI_PROVIDERS[type as keyof typeof AI_PROVIDERS];
      const model = this.settings.models[type] || providerConfig.defaultModel;
      provider.setModel(model);
    }
  }

  isAvailable(): boolean {
    if (!this.settings.enabled) return false;

    const provider = this.getCurrentProvider();
    return provider?.isAvailable() ?? false;
  }

  // ============================================
  // Standard LLM Methods
  // ============================================

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      return { success: false, content: '', error: '프로바이더가 선택되지 않았습니다.' };
    }
    if (!provider.isAvailable()) {
      return { success: false, content: '', error: 'API 키가 설정되지 않았습니다.' };
    }
    return provider.generate(messages, options);
  }

  async simpleGenerate(
    userPrompt: string,
    systemPrompt?: string,
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    const messages: LLMMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });
    return this.generate(messages, options);
  }

  async testApiKey(type: AIProviderType, apiKey: string): Promise<boolean> {
    const provider = this.providers.get(type);
    if (!provider) return false;
    return provider.testApiKey(apiKey);
  }

  // ============================================
  // Learning Path Specific Methods
  // ============================================

  async analyzeDependencies(
    noteContent: string,
    linkedNoteContents: string[]
  ): Promise<LLMResponse<DependencyAnalysisResult>> {
    const provider = this.getCurrentProvider();
    if (!provider || !provider.isAvailable()) {
      return { success: false, error: '프로바이더를 사용할 수 없습니다.' };
    }
    return provider.analyzeDependencies(noteContent, linkedNoteContents);
  }

  async identifyKnowledgeGaps(
    pathDescription: string,
    existingConcepts: string[]
  ): Promise<LLMResponse<KnowledgeGapAnalysisResult>> {
    const provider = this.getCurrentProvider();
    if (!provider || !provider.isAvailable()) {
      return { success: false, error: '프로바이더를 사용할 수 없습니다.' };
    }
    return provider.identifyKnowledgeGaps(pathDescription, existingConcepts);
  }

  async suggestLearningOrder(
    concepts: string[],
    currentDependencies: DependencyRelation[]
  ): Promise<LLMResponse<string[]>> {
    const provider = this.getCurrentProvider();
    if (!provider || !provider.isAvailable()) {
      return { success: false, error: '프로바이더를 사용할 수 없습니다.' };
    }
    return provider.suggestLearningOrder(concepts, currentDependencies);
  }

  async analyzeNotesForLearningPath(
    goalNote: { title: string; content: string },
    relatedNotes: Array<{ title: string; content: string }>
  ): Promise<LLMResponse<LearningPathAnalysisResult>> {
    const provider = this.getCurrentProvider();
    if (!provider || !provider.isAvailable()) {
      return { success: false, error: '프로바이더를 사용할 수 없습니다.' };
    }
    return provider.analyzeNotesForLearningPath(goalNote, relatedNotes);
  }
}

// ============================================
// Singleton Management
// ============================================

let aiServiceInstance: AIService | null = null;

export function initializeAIService(settings: AISettings): AIService {
  aiServiceInstance = new AIService(settings);
  return aiServiceInstance;
}

export function getAIService(): AIService | null {
  return aiServiceInstance;
}

export function destroyAIService(): void {
  aiServiceInstance = null;
}
