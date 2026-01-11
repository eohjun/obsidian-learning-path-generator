/**
 * EmbeddingService
 *
 * Service that generates query embeddings and performs similarity search.
 * Note embeddings are handled by Vault Embeddings plugin,
 * this service only embeds search queries to find similar notes.
 *
 * Architecture:
 * - IEmbeddingProvider: Converts query text to vectors (OpenAI API)
 * - IVectorStore: Searches for similar vectors in stored embeddings (reads Vault Embeddings)
 */

import type {
  IEmbeddingProvider,
  IVectorStore,
  VectorSearchOptions,
  SemanticSearchResult,
} from '../../domain';

/**
 * Embedding service configuration
 */
export interface EmbeddingServiceConfig {
  /** Maximum query text length (for token savings) */
  maxQueryLength?: number;
}

const DEFAULT_CONFIG: Required<EmbeddingServiceConfig> = {
  maxQueryLength: 8000,
};

/**
 * Embedding Service
 *
 * Performs query embedding generation and similarity search.
 * Note embedding generation is handled by Vault Embeddings plugin.
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
   * Check service availability
   * - OpenAI API key must be configured
   * - Vault Embeddings data must exist
   */
  isAvailable(): boolean {
    return this.embeddingProvider.isAvailable() && this.vectorStore.size() > 0;
  }

  /**
   * Search for notes similar to query text
   *
   * @param query - Search query (concepts, keywords, etc.)
   * @param options - Search options
   * @returns Search results sorted by similarity
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
      // Generate query embedding
      const cleanedQuery = this.prepareQuery(query);
      const queryVector = await this.embeddingProvider.embed(cleanedQuery);

      // Search in vector store
      const results = this.vectorStore.search(queryVector, options);

      // Convert to SemanticSearchResult format
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
   * Check if note has embedding
   *
   * @param noteId - Note ID to check
   */
  hasEmbedding(noteId: string): boolean {
    return this.vectorStore.has(noteId);
  }

  /**
   * Get number of stored embeddings
   */
  getEmbeddingCount(): number {
    return this.vectorStore.size();
  }

  /**
   * Get list of stored note IDs
   */
  getStoredNoteIds(): string[] {
    return this.vectorStore.getStoredNoteIds();
  }

  /**
   * Preprocess query text
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
 * Initialize embedding service
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
 * Get embedding service instance
 */
export function getEmbeddingService(): EmbeddingService | null {
  return embeddingServiceInstance;
}

/**
 * Destroy embedding service
 */
export function destroyEmbeddingService(): void {
  embeddingServiceInstance = null;
}
