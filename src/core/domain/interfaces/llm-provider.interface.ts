/**
 * LLM Provider Interface
 * 표준 LLM Provider 인터페이스 + 학습 경로 전용 메서드
 */

import { DependencyRelation } from '../value-objects/dependency-relation';
import { KnowledgeGap } from '../entities/knowledge-gap';

// ============================================
// Standard LLM Provider Types
// ============================================

export type AIProviderType = 'claude' | 'openai' | 'gemini' | 'grok';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMGenerateOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: number;
}

export interface LLMResponse<T = string> {
  success: boolean;
  content?: string;
  data?: T;
  error?: string;
  rawResponse?: string;
  usage?: LLMUsage;
}

// ============================================
// Learning Path Specific Types
// ============================================

export interface DependencyAnalysisResult {
  dependencies: DependencyRelation[];
  concepts: string[];
  confidence: number;
}

export interface KnowledgeGapAnalysisResult {
  gaps: KnowledgeGap[];
  summary: string;
}

export interface KnowledgeGapItem {
  concept: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suggestedResources: string[];
}

export interface LearningPathAnalysisResult {
  learningOrder: string[];
  dependencies: Array<{ from: string; to: string; reason: string }>;
  estimatedMinutes: Record<string, number>;
  knowledgeGaps: KnowledgeGapItem[];
}

// ============================================
// Standard LLM Provider Interface
// ============================================

export interface ILLMProvider {
  readonly name: string;
  readonly providerType: AIProviderType;
  readonly modelId: string;

  setApiKey(apiKey: string): void;
  setModel(modelId: string): void;
  generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse>;
  simpleGenerate(userPrompt: string, systemPrompt?: string, options?: LLMGenerateOptions): Promise<LLMResponse>;
  isAvailable(): boolean;
  testApiKey(apiKey: string): Promise<boolean>;

  // Learning Path specific methods
  analyzeDependencies(
    noteContent: string,
    linkedNoteContents: string[]
  ): Promise<LLMResponse<DependencyAnalysisResult>>;

  identifyKnowledgeGaps(
    pathDescription: string,
    existingConcepts: string[]
  ): Promise<LLMResponse<KnowledgeGapAnalysisResult>>;

  suggestLearningOrder(
    concepts: string[],
    currentDependencies: DependencyRelation[]
  ): Promise<LLMResponse<string[]>>;

  analyzeNotesForLearningPath(
    goalNote: { title: string; content: string },
    relatedNotes: Array<{ title: string; content: string }>
  ): Promise<LLMResponse<LearningPathAnalysisResult>>;
}
