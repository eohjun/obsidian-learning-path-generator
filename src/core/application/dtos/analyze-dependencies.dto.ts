/**
 * AnalyzeDependencies Use Case DTOs
 * LLM 기반 의존성 분석 요청/응답 데이터 전송 객체
 */

import { DependencyRelationData, KnowledgeGapData } from '../../domain';

export interface AnalyzeDependenciesRequest {
  /**
   * 분석할 노트 ID들
   */
  noteIds: string[];

  /**
   * 분석 깊이 (연결된 노트까지 분석)
   */
  depth?: number;

  /**
   * 기존 의존관계 포함 여부
   */
  includeExisting?: boolean;
}

export interface AnalyzeDependenciesResponse {
  /**
   * 성공 여부
   */
  success: boolean;

  /**
   * 발견된 의존 관계들
   */
  dependencies?: DependencyRelationData[];

  /**
   * 식별된 지식 갭들
   */
  knowledgeGaps?: KnowledgeGapData[];

  /**
   * 발견된 핵심 개념들
   */
  concepts?: string[];

  /**
   * 분석 신뢰도 (0-1)
   */
  confidence?: number;

  /**
   * 에러 메시지
   */
  error?: string;
}

export interface IdentifyKnowledgeGapsRequest {
  /**
   * 학습 경로 ID
   */
  pathId: string;

  /**
   * 볼트에 존재하는 개념들
   */
  existingConcepts?: string[];
}

export interface IdentifyKnowledgeGapsResponse {
  /**
   * 성공 여부
   */
  success: boolean;

  /**
   * 식별된 지식 갭들
   */
  gaps?: KnowledgeGapData[];

  /**
   * 분석 요약
   */
  summary?: string;

  /**
   * 에러 메시지
   */
  error?: string;
}
