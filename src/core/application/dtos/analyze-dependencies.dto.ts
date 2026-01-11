/**
 * AnalyzeDependencies Use Case DTOs
 * LLM-based dependency analysis request/response data transfer objects
 */

import { DependencyRelationData, KnowledgeGapData } from '../../domain';

export interface AnalyzeDependenciesRequest {
  /**
   * Note IDs to analyze
   */
  noteIds: string[];

  /**
   * Analysis depth (analyze up to connected notes)
   */
  depth?: number;

  /**
   * Whether to include existing dependencies
   */
  includeExisting?: boolean;
}

export interface AnalyzeDependenciesResponse {
  /**
   * Success status
   */
  success: boolean;

  /**
   * Discovered dependencies
   */
  dependencies?: DependencyRelationData[];

  /**
   * Identified knowledge gaps
   */
  knowledgeGaps?: KnowledgeGapData[];

  /**
   * Discovered core concepts
   */
  concepts?: string[];

  /**
   * Analysis confidence (0-1)
   */
  confidence?: number;

  /**
   * Error message
   */
  error?: string;
}

export interface IdentifyKnowledgeGapsRequest {
  /**
   * Learning path ID
   */
  pathId: string;

  /**
   * Concepts existing in vault
   */
  existingConcepts?: string[];
}

export interface IdentifyKnowledgeGapsResponse {
  /**
   * Success status
   */
  success: boolean;

  /**
   * Identified knowledge gaps
   */
  gaps?: KnowledgeGapData[];

  /**
   * Analysis summary
   */
  summary?: string;

  /**
   * Error message
   */
  error?: string;
}
