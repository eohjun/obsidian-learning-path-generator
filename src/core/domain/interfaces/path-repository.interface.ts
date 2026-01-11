/**
 * IPathRepository Interface
 * Learning path repository interface
 *
 * Implemented with JSON files or other storage in the Adapters layer
 */

import { LearningPath, LearningPathData } from '../entities/learning-path';

export interface IPathRepository {
  /**
   * Save learning path
   */
  save(path: LearningPath): Promise<void>;

  /**
   * Find learning path by ID
   */
  findById(id: string): Promise<LearningPath | null>;

  /**
   * Find learning path by goal note
   */
  findByGoalNote(goalNoteId: string): Promise<LearningPath | null>;

  /**
   * Get all learning paths
   */
  findAll(): Promise<LearningPath[]>;

  /**
   * Delete learning path
   */
  delete(id: string): Promise<void>;

  /**
   * Check if learning path exists
   */
  exists(id: string): Promise<boolean>;
}
