/**
 * GenerateLearningPath Use Case DTOs
 * 학습 경로 생성 요청/응답 데이터 전송 객체
 */

import { LearningPathData, LearningNodeData, KnowledgeGapItem } from '../../domain';

export interface GeneratePathRequest {
  /**
   * 학습 경로 이름
   */
  name: string;

  /**
   * 시작 노트 ID들 (선택 사항)
   * 지정하지 않으면 연결된 노트들에서 자동 탐색
   */
  startNoteIds?: string[];

  /**
   * 목표 노트 ID (선택 사항)
   * 특정 목표로 향하는 경로를 생성
   */
  goalNoteId?: string;

  /**
   * 대상 폴더 경로 (선택 사항)
   * 특정 폴더 내의 노트들로 제한
   */
  folder?: string;

  /**
   * 제외할 폴더들
   */
  excludeFolders?: string[];

  /**
   * 경로 설명
   */
  description?: string;

  /**
   * LLM을 사용한 의존성 분석 여부
   */
  useLLMAnalysis?: boolean;
}

export interface GeneratePathResponse {
  /**
   * 성공 여부
   */
  success: boolean;

  /**
   * 생성된 학습 경로 데이터
   */
  path?: LearningPathData;

  /**
   * 경로 내 노드들
   */
  nodes?: LearningNodeData[];

  /**
   * 레벨별 노드 그룹 (병렬 학습 가능)
   */
  levels?: string[][];

  /**
   * 에러 메시지
   */
  error?: string;

  /**
   * 경고 메시지들 (순환 의존성 등)
   */
  warnings?: string[];

  /**
   * 지식 갭 - 목표 이해에 필요하지만 볼트에 없는 개념들
   */
  knowledgeGaps?: KnowledgeGapItem[];

  /**
   * 전체 관련 노트 수 (분석 범위)
   */
  totalAnalyzedNotes?: number;
}
