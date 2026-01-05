export {
  type INoteRepository,
  type NoteData,
} from './note-repository.interface';

export { type IPathRepository } from './path-repository.interface';

export {
  type IProgressRepository,
  type ProgressData,
} from './progress-repository.interface';

export {
  type ILLMProvider,
  type LLMResponse,
  type LLMMessage,
  type LLMGenerateOptions,
  type LLMUsage,
  type AIProviderType,
  type DependencyAnalysisResult,
  type KnowledgeGapAnalysisResult,
  type LearningPathAnalysisResult,
  type KnowledgeGapItem,
} from './llm-provider.interface';
