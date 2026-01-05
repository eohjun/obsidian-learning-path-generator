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
  type DependencyAnalysisResult,
  type KnowledgeGapAnalysisResult,
} from './interfaces';

// Services
export { DependencyAnalyzer, type DependencyGraph } from './services';
