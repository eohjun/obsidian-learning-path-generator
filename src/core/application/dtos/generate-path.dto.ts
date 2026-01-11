/**
 * GenerateLearningPath Use Case DTOs
 * Learning path generation request/response data transfer objects
 */

import { LearningPathData, LearningNodeData, KnowledgeGapItem } from '../../domain';

export interface GeneratePathRequest {
  /**
   * Learning path name
   */
  name: string;

  /**
   * Start note IDs (optional)
   * If not specified, automatically traverses from connected notes
   */
  startNoteIds?: string[];

  /**
   * Goal note ID (optional)
   * Generate path toward a specific goal
   */
  goalNoteId?: string;

  /**
   * Target folder path (optional)
   * Restrict to notes within a specific folder
   */
  folder?: string;

  /**
   * Folders to exclude
   */
  excludeFolders?: string[];

  /**
   * Path description
   */
  description?: string;

  /**
   * Whether to use LLM for dependency analysis
   */
  useLLMAnalysis?: boolean;
}

export interface GeneratePathResponse {
  /**
   * Success status
   */
  success: boolean;

  /**
   * Generated learning path data
   */
  path?: LearningPathData;

  /**
   * Nodes in the path
   */
  nodes?: LearningNodeData[];

  /**
   * Node groups by level (parallel learning possible)
   */
  levels?: string[][];

  /**
   * Error message
   */
  error?: string;

  /**
   * Warning messages (circular dependencies, etc.)
   */
  warnings?: string[];

  /**
   * Knowledge gaps - concepts needed to understand goal but missing from vault
   */
  knowledgeGaps?: KnowledgeGapItem[];

  /**
   * Total number of analyzed notes (analysis scope)
   */
  totalAnalyzedNotes?: number;
}
