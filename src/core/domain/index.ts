// Value Objects
export {
  MasteryLevel,
  MasteryLevelValue,
  DependencyRelation,
  DependencyType,
  PathStatistics,
  type DependencyRelationData,
  type PathStatisticsData,
} from './value-objects';

// Entities
export {
  LearningNode,
  LearningPath,
  KnowledgeGap,
  type LearningNodeData,
  type LearningPathData,
  type KnowledgeGapData,
} from './entities';

// Interfaces
export {
  type INoteRepository,
  type NoteData,
  type IPathRepository,
  type IProgressRepository,
  type ProgressData,
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
  type ConceptExtractionResult,
  type ISemanticSearchService,
  type SemanticSearchResult,
} from './interfaces';

// Constants
export {
  AI_PROVIDERS,
  MODEL_CONFIGS,
  getModelsByProvider,
  getModelConfig,
  type AIProviderConfig,
  type ModelConfig,
} from './constants/model-configs';

// Services
export { DependencyAnalyzer, type DependencyGraph } from './services';
