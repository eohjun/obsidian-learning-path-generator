/**
 * ILLMProvider Interface
 * LLM을 통한 의존성 분석 인터페이스
 *
 * Adapters 레이어에서 OpenAI, Claude, Gemini 등으로 구현
 */

import { DependencyRelation } from '../value-objects/dependency-relation';
import { KnowledgeGap } from '../entities/knowledge-gap';

export interface LLMResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawResponse?: string;
}

export interface DependencyAnalysisResult {
  /**
   * 분석된 의존 관계들
   */
  dependencies: DependencyRelation[];

  /**
   * 핵심 개념들
   */
  concepts: string[];

  /**
   * 분석 신뢰도 (0-1)
   */
  confidence: number;
}

export interface KnowledgeGapAnalysisResult {
  /**
   * 식별된 지식 갭들
   */
  gaps: KnowledgeGap[];

  /**
   * 분석 요약
   */
  summary: string;
}

export interface ILLMProvider {
  /**
   * 노트 내용 분석하여 의존성 추출
   *
   * @param noteContent 분석할 노트 내용
   * @param linkedNoteContents 연결된 노트들의 내용 (컨텍스트)
   * @returns 의존성 분석 결과
   */
  analyzeDependencies(
    noteContent: string,
    linkedNoteContents: string[]
  ): Promise<LLMResponse<DependencyAnalysisResult>>;

  /**
   * 학습 경로 분석하여 지식 갭 식별
   *
   * @param pathDescription 학습 경로 설명
   * @param existingConcepts 볼트에 존재하는 개념들
   * @returns 지식 갭 분석 결과
   */
  identifyKnowledgeGaps(
    pathDescription: string,
    existingConcepts: string[]
  ): Promise<LLMResponse<KnowledgeGapAnalysisResult>>;

  /**
   * 학습 순서 최적화 제안
   *
   * @param concepts 학습할 개념들
   * @param currentDependencies 현재 파악된 의존관계
   * @returns 최적화된 학습 순서
   */
  suggestLearningOrder(
    concepts: string[],
    currentDependencies: DependencyRelation[]
  ): Promise<LLMResponse<string[]>>;

  /**
   * Provider 이름
   */
  readonly name: string;

  /**
   * Provider 사용 가능 여부
   */
  isAvailable(): Promise<boolean>;
}
