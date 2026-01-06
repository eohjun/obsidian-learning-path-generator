/**
 * InMemoryVectorStore
 *
 * 메모리 기반 벡터 저장소.
 * Cosine Similarity를 사용하여 유사 벡터 검색.
 */

import type {
  IVectorStore,
  EmbeddingVector,
  VectorSearchResult,
  VectorSearchOptions,
} from '../../core/domain';

const DEFAULT_LIMIT = 10;
const DEFAULT_THRESHOLD = 0.3;

export class InMemoryVectorStore implements IVectorStore {
  private vectors: Map<string, EmbeddingVector> = new Map();

  /**
   * 임베딩 벡터 저장
   */
  store(embedding: EmbeddingVector): void {
    this.vectors.set(embedding.noteId, embedding);
  }

  /**
   * 유사 벡터 검색 (Cosine Similarity)
   */
  search(queryVector: number[], options?: VectorSearchOptions): VectorSearchResult[] {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
    const excludeNoteIds = new Set(options?.excludeNoteIds ?? []);

    const results: VectorSearchResult[] = [];

    for (const [noteId, embedding] of this.vectors) {
      // 제외할 노트 건너뛰기
      if (excludeNoteIds.has(noteId)) {
        continue;
      }

      const similarity = this.cosineSimilarity(queryVector, embedding.vector);

      // 임계값 이상인 경우만 추가
      if (similarity >= threshold) {
        results.push({
          noteId,
          notePath: embedding.notePath,
          similarity,
        });
      }
    }

    // 유사도 내림차순 정렬 후 limit 적용
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * 저장된 노트 ID 목록 조회
   */
  getStoredNoteIds(): string[] {
    return Array.from(this.vectors.keys());
  }

  /**
   * 특정 노트의 임베딩 삭제
   */
  remove(noteId: string): void {
    this.vectors.delete(noteId);
  }

  /**
   * 저장소 전체 초기화
   */
  clear(): void {
    this.vectors.clear();
  }

  /**
   * 저장된 벡터 수
   */
  size(): number {
    return this.vectors.size;
  }

  /**
   * 특정 노트의 임베딩 존재 여부 확인
   */
  has(noteId: string): boolean {
    return this.vectors.has(noteId);
  }

  /**
   * Cosine Similarity 계산
   *
   * @param a - 첫 번째 벡터
   * @param b - 두 번째 벡터
   * @returns 유사도 (0.0 ~ 1.0)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      console.warn('[InMemoryVectorStore] Vector dimension mismatch');
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }
}
