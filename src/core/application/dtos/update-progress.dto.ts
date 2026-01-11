/**
 * UpdateProgress Use Case DTOs
 * Learning progress update request/response data transfer objects
 */

import { MasteryLevelValue, PathStatisticsData } from '../../domain';

export interface UpdateProgressRequest {
  /**
   * Learning path ID
   */
  pathId: string;

  /**
   * Node ID
   */
  nodeId: string;

  /**
   * New mastery level
   */
  newLevel: MasteryLevelValue;
}

export interface UpdateProgressResponse {
  /**
   * Success status
   */
  success: boolean;

  /**
   * Updated path statistics
   */
  statistics?: PathStatisticsData;

  /**
   * Next recommended node IDs for learning
   */
  nextRecommendedNodes?: string[];

  /**
   * Error message
   */
  error?: string;
}

export interface BulkUpdateProgressRequest {
  /**
   * Learning path ID
   */
  pathId: string;

  /**
   * Progress updates for multiple nodes
   */
  updates: Array<{
    nodeId: string;
    newLevel: MasteryLevelValue;
  }>;
}

export interface BulkUpdateProgressResponse {
  /**
   * Success status
   */
  success: boolean;

  /**
   * Updated path statistics
   */
  statistics?: PathStatisticsData;

  /**
   * Failed updates
   */
  failed?: Array<{
    nodeId: string;
    error: string;
  }>;

  /**
   * Error message
   */
  error?: string;
}
