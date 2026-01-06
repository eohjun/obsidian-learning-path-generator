/**
 * IVectorStore Interface
 *
 * 임베딩 벡터를 저장하고 유사도 검색을 수행하는 저장소 인터페이스.
 * In-Memory, IndexedDB 등 다양한 저장소를 추상화.
 */

import type { EmbeddingVector } from './embedding-provider.interface';

/**
 * 벡터 검색 결과
 */
export interface VectorSearchResult {
  /** 노트 식별자 */
  noteId: string;
  /** 노트 파일 경로 */
  notePath: string;
  /** 유사도 점수 (0.0 ~ 1.0) */
  similarity: number;
}

/**
 * 벡터 검색 옵션
 */
export interface VectorSearchOptions {
  /** 반환할 최대 결과 수 */
  limit?: number;
  /** 최소 유사도 임계값 (0.0 ~ 1.0) */
  threshold?: number;
  /** 제외할 노트 ID 목록 */
  excludeNoteIds?: string[];
}

/**
 * 벡터 저장소 인터페이스
 */
export interface IVectorStore {
  /**
   * 임베딩 벡터 저장
   *
   * @param embedding - 저장할 임베딩 벡터
   */
  store(embedding: EmbeddingVector): void;

  /**
   * 유사 벡터 검색 (Cosine Similarity)
   *
   * @param queryVector - 검색 쿼리 벡터
   * @param options - 검색 옵션
   * @returns 유사도 순으로 정렬된 검색 결과
   */
  search(queryVector: number[], options?: VectorSearchOptions): VectorSearchResult[];

  /**
   * 저장된 노트 ID 목록 조회
   *
   * @returns 저장된 모든 노트 ID
   */
  getStoredNoteIds(): string[];

  /**
   * 특정 노트의 임베딩 삭제
   *
   * @param noteId - 삭제할 노트 ID
   */
  remove(noteId: string): void;

  /**
   * 저장소 전체 초기화
   */
  clear(): void;

  /**
   * 저장된 벡터 수
   *
   * @returns 현재 저장된 임베딩 벡터 수
   */
  size(): number;

  /**
   * 특정 노트의 임베딩 존재 여부 확인
   *
   * @param noteId - 확인할 노트 ID
   * @returns 임베딩이 존재하면 true
   */
  has(noteId: string): boolean;
}
