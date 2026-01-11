/**
 * IProgressRepository Interface
 * Learning progress status repository interface
 *
 * Implemented with frontmatter or separate storage in the Adapters layer
 */

import { MasteryLevel } from '../value-objects/mastery-level';

export interface ProgressData {
  noteId: string;
  masteryLevel: string;
  lastStudied: string | null;
  studyCount: number;
}

export interface IProgressRepository {
  /**
   * Get note progress status
   */
  getProgress(noteId: string): Promise<MasteryLevel>;

  /**
   * Update note progress status
   */
  updateProgress(noteId: string, level: MasteryLevel): Promise<void>;

  /**
   * Get last studied time of note
   */
  getLastStudied(noteId: string): Promise<Date | null>;

  /**
   * Update last studied time of note
   */
  updateLastStudied(noteId: string, date: Date): Promise<void>;

  /**
   * Increment study completion count
   */
  incrementStudyCount(noteId: string): Promise<void>;

  /**
   * Bulk get progress status for multiple notes
   */
  getBulkProgress(noteIds: string[]): Promise<Map<string, MasteryLevel>>;

  /**
   * Reset progress status
   */
  resetProgress(noteId: string): Promise<void>;

  /**
   * Reset all progress status
   */
  resetAllProgress(): Promise<void>;
}
