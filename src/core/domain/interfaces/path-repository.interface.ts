/**
 * IPathRepository Interface
 * 학습 경로 저장소 인터페이스
 *
 * Adapters 레이어에서 JSON 파일 또는 다른 저장소로 구현
 */

import { LearningPath, LearningPathData } from '../entities/learning-path';

export interface IPathRepository {
  /**
   * 학습 경로 저장
   */
  save(path: LearningPath): Promise<void>;

  /**
   * ID로 학습 경로 조회
   */
  findById(id: string): Promise<LearningPath | null>;

  /**
   * 목표 노트로 학습 경로 조회
   */
  findByGoalNote(goalNoteId: string): Promise<LearningPath | null>;

  /**
   * 모든 학습 경로 조회
   */
  findAll(): Promise<LearningPath[]>;

  /**
   * 학습 경로 삭제
   */
  delete(id: string): Promise<void>;

  /**
   * 학습 경로 존재 여부 확인
   */
  exists(id: string): Promise<boolean>;
}
