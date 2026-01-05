/**
 * UpdateProgress Use Case DTOs
 * 학습 진행 상태 업데이트 요청/응답 데이터 전송 객체
 */

import { MasteryLevelValue, PathStatisticsData } from '../../domain';

export interface UpdateProgressRequest {
  /**
   * 학습 경로 ID
   */
  pathId: string;

  /**
   * 노드 ID
   */
  nodeId: string;

  /**
   * 새로운 숙달 레벨
   */
  newLevel: MasteryLevelValue;
}

export interface UpdateProgressResponse {
  /**
   * 성공 여부
   */
  success: boolean;

  /**
   * 업데이트된 경로 통계
   */
  statistics?: PathStatisticsData;

  /**
   * 다음 학습 추천 노드 ID들
   */
  nextRecommendedNodes?: string[];

  /**
   * 에러 메시지
   */
  error?: string;
}

export interface BulkUpdateProgressRequest {
  /**
   * 학습 경로 ID
   */
  pathId: string;

  /**
   * 여러 노드의 진행 상태 업데이트
   */
  updates: Array<{
    nodeId: string;
    newLevel: MasteryLevelValue;
  }>;
}

export interface BulkUpdateProgressResponse {
  /**
   * 성공 여부
   */
  success: boolean;

  /**
   * 업데이트된 경로 통계
   */
  statistics?: PathStatisticsData;

  /**
   * 실패한 업데이트들
   */
  failed?: Array<{
    nodeId: string;
    error: string;
  }>;

  /**
   * 에러 메시지
   */
  error?: string;
}
