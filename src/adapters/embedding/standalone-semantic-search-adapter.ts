/**
 * StandaloneSemanticSearchAdapter
 *
 * Implements ISemanticSearchService interface using EmbeddingService.
 * Performs semantic-based search independently without PKM Note Recommender dependency.
 */

import type {
  ISemanticSearchService,
  SemanticSearchResult,
} from '../../core/domain';
import type { EmbeddingService } from '../../core/application/services';

export class StandaloneSemanticSearchAdapter implements ISemanticSearchService {
  constructor(private embeddingService: EmbeddingService) {}

  /**
   * Check service availability
   */
  isAvailable(): boolean {
    return this.embeddingService.isAvailable();
  }

  /**
   * Search for notes similar to text content
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
   * Batch search for multiple concepts
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
      // Return empty array for all concepts
      for (const concept of concepts) {
        resultsMap.set(concept, []);
      }
      return resultsMap;
    }

    // Search sequentially for each concept (prevent API overload)
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
