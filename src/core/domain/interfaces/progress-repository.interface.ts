/**
 * IProgressRepository Interface
 * 학습 진행 상태 저장소 인터페이스
 *
 * Adapters 레이어에서 frontmatter 또는 별도 저장소로 구현
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
   * 노트의 진행 상태 조회
   */
  getProgress(noteId: string): Promise<MasteryLevel>;

  /**
   * 노트의 진행 상태 업데이트
   */
  updateProgress(noteId: string, level: MasteryLevel): Promise<void>;

  /**
   * 노트의 마지막 학습 시간 조회
   */
  getLastStudied(noteId: string): Promise<Date | null>;

  /**
   * 노트의 마지막 학습 시간 업데이트
   */
  updateLastStudied(noteId: string, date: Date): Promise<void>;

  /**
   * 여러 노트의 진행 상태 일괄 조회
   */
  getBulkProgress(noteIds: string[]): Promise<Map<string, MasteryLevel>>;

  /**
   * 진행 상태 초기화
   */
  resetProgress(noteId: string): Promise<void>;

  /**
   * 모든 진행 상태 초기화
   */
  resetAllProgress(): Promise<void>;
}
