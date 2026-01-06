/**
 * StandaloneSemanticSearchAdapter
 *
 * EmbeddingService를 사용하여 ISemanticSearchService 인터페이스 구현.
 * PKM Note Recommender 의존성 없이 독립적으로 의미 기반 검색 수행.
 */

import type {
  ISemanticSearchService,
  SemanticSearchResult,
} from '../../core/domain';
import type { EmbeddingService } from '../../core/application/services';

export class StandaloneSemanticSearchAdapter implements ISemanticSearchService {
  constructor(private embeddingService: EmbeddingService) {}

  /**
   * 서비스 사용 가능 여부 확인
   */
  isAvailable(): boolean {
    return this.embeddingService.isAvailable();
  }

  /**
   * 텍스트 내용과 유사한 노트 검색
   */
  async findSimilarToContent(
    content: string,
    options?: {
      limit?: number;
      threshold?: number;
      excludeNoteIds?: string[];
    }
  ): Promise<SemanticSearchResult[]> {
    if (!this.isAvailable()) {
      console.warn('[StandaloneSemanticSearchAdapter] Service not available');
      return [];
    }

    try {
      const results = await this.embeddingService.findSimilar(content, {
        limit: options?.limit ?? 10,
        threshold: options?.threshold ?? 0.3,
        excludeNoteIds: options?.excludeNoteIds,
      });

      return results;
    } catch (error) {
      console.error('[StandaloneSemanticSearchAdapter] Search failed:', error);
      return [];
    }
  }

  /**
   * 여러 개념에 대해 일괄 검색
   */
  async findNotesForConcepts(
    concepts: string[],
    options?: {
      limitPerConcept?: number;
      threshold?: number;
      excludeNoteIds?: string[];
    }
  ): Promise<Map<string, SemanticSearchResult[]>> {
    const resultsMap = new Map<string, SemanticSearchResult[]>();

    if (!this.isAvailable()) {
      console.warn('[StandaloneSemanticSearchAdapter] Service not available for batch search');
      // 모든 개념에 대해 빈 배열 반환
      for (const concept of concepts) {
        resultsMap.set(concept, []);
      }
      return resultsMap;
    }

    // 각 개념에 대해 순차적으로 검색 (API 부하 방지)
    for (const concept of concepts) {
      try {
        const results = await this.findSimilarToContent(concept, {
          limit: options?.limitPerConcept ?? 5,
          threshold: options?.threshold ?? 0.3,
          excludeNoteIds: options?.excludeNoteIds,
        });
        resultsMap.set(concept, results);
      } catch (error) {
        console.error(`[StandaloneSemanticSearchAdapter] Failed to search concept: ${concept}`, error);
        resultsMap.set(concept, []);
      }
    }

    return resultsMap;
  }
}
