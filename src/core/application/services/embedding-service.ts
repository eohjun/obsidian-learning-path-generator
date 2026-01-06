/**
 * EmbeddingService
 *
 * 쿼리 임베딩 생성 및 유사도 검색을 수행하는 서비스.
 * 노트 임베딩은 Vault Embeddings 플러그인이 담당하고,
 * 이 서비스는 검색 쿼리를 임베딩하여 유사 노트를 찾는 역할만 담당.
 *
 * Architecture:
 * - IEmbeddingProvider: 쿼리 텍스트를 벡터로 변환 (OpenAI API)
 * - IVectorStore: 저장된 임베딩에서 유사 벡터 검색 (Vault Embeddings 읽기)
 */

import type {
  IEmbeddingProvider,
  IVectorStore,
  VectorSearchOptions,
  SemanticSearchResult,
} from '../../domain';

/**
 * 임베딩 서비스 설정
 */
export interface EmbeddingServiceConfig {
  /** 쿼리 텍스트 최대 길이 (토큰 절약) */
  maxQueryLength?: number;
}

const DEFAULT_CONFIG: Required<EmbeddingServiceConfig> = {
  maxQueryLength: 8000,
};

/**
 * 임베딩 서비스
 *
 * 쿼리 임베딩 생성 및 유사도 검색을 수행.
 * 노트 임베딩 생성은 Vault Embeddings 플러그인이 담당.
 */
export class EmbeddingService {
  private config: Required<EmbeddingServiceConfig>;

  constructor(
    private embeddingProvider: IEmbeddingProvider,
    private vectorStore: IVectorStore,
    config?: EmbeddingServiceConfig
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 서비스 사용 가능 여부
   * - OpenAI API 키가 설정되어 있고
   * - Vault Embeddings 데이터가 있어야 함
   */
  isAvailable(): boolean {
    return this.embeddingProvider.isAvailable() && this.vectorStore.size() > 0;
  }

  /**
   * 쿼리 텍스트와 유사한 노트 검색
   *
   * @param query - 검색 쿼리 (개념, 키워드 등)
   * @param options - 검색 옵션
   * @returns 유사도 순 검색 결과
   */
  async findSimilar(
    query: string,
    options?: VectorSearchOptions
  ): Promise<SemanticSearchResult[]> {
    if (!this.embeddingProvider.isAvailable()) {
      console.warn('[EmbeddingService] Query embedding provider not available');
      return [];
    }

    if (this.vectorStore.size() === 0) {
      console.warn('[EmbeddingService] No embeddings available. Run Vault Embeddings plugin first.');
      return [];
    }

    try {
      // 쿼리 임베딩 생성
      const cleanedQuery = this.prepareQuery(query);
      const queryVector = await this.embeddingProvider.embed(cleanedQuery);

      // 벡터 저장소에서 검색
      const results = this.vectorStore.search(queryVector, options);

      // SemanticSearchResult 형식으로 변환
      return results.map(r => ({
        noteId: r.noteId,
        notePath: r.notePath,
        similarity: r.similarity,
      }));
    } catch (error) {
      console.error('[EmbeddingService] Search failed:', error);
      return [];
    }
  }

  /**
   * 노트가 임베딩되었는지 확인
   *
   * @param noteId - 확인할 노트 ID
   */
  hasEmbedding(noteId: string): boolean {
    return this.vectorStore.has(noteId);
  }

  /**
   * 저장된 임베딩 수
   */
  getEmbeddingCount(): number {
    return this.vectorStore.size();
  }

  /**
   * 저장된 노트 ID 목록
   */
  getStoredNoteIds(): string[] {
    return this.vectorStore.getStoredNoteIds();
  }

  /**
   * 쿼리 텍스트 전처리
   */
  private prepareQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, this.config.maxQueryLength);
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let embeddingServiceInstance: EmbeddingService | null = null;

/**
 * 임베딩 서비스 초기화
 */
export function initializeEmbeddingService(
  embeddingProvider: IEmbeddingProvider,
  vectorStore: IVectorStore,
  config?: EmbeddingServiceConfig
): EmbeddingService {
  embeddingServiceInstance = new EmbeddingService(
    embeddingProvider,
    vectorStore,
    config
  );
  return embeddingServiceInstance;
}

/**
 * 임베딩 서비스 인스턴스 조회
 */
export function getEmbeddingService(): EmbeddingService | null {
  return embeddingServiceInstance;
}

/**
 * 임베딩 서비스 정리
 */
export function destroyEmbeddingService(): void {
  embeddingServiceInstance = null;
}
