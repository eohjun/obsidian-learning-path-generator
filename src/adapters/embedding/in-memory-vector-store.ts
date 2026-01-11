/**
 * InMemoryVectorStore
 *
 * Memory-based vector store.
 * Uses Cosine Similarity for similar vector search.
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
   * Store embedding vector
   */
  store(embedding: EmbeddingVector): void {
    this.vectors.set(embedding.noteId, embedding);
  }

  /**
   * Search for similar vectors (Cosine Similarity)
   */
  search(queryVector: number[], options?: VectorSearchOptions): VectorSearchResult[] {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
    const excludeNoteIds = new Set(options?.excludeNoteIds ?? []);

    const results: VectorSearchResult[] = [];

    for (const [noteId, embedding] of this.vectors) {
      // Skip excluded notes
      if (excludeNoteIds.has(noteId)) {
        continue;
      }

      const similarity = this.cosineSimilarity(queryVector, embedding.vector);

      // Only add if above threshold
      if (similarity >= threshold) {
        results.push({
          noteId,
          notePath: embedding.notePath,
          similarity,
        });
      }
    }

    // Sort by similarity descending and apply limit
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Get list of stored note IDs
   */
  getStoredNoteIds(): string[] {
    return Array.from(this.vectors.keys());
  }

  /**
   * Remove embedding for a specific note
   */
  remove(noteId: string): void {
    this.vectors.delete(noteId);
  }

  /**
   * Clear entire store
   */
  clear(): void {
    this.vectors.clear();
  }

  /**
   * Get number of stored vectors
   */
  size(): number {
    return this.vectors.size;
  }

  /**
   * Check if embedding exists for a specific note
   */
  has(noteId: string): boolean {
    return this.vectors.has(noteId);
  }

  /**
   * Calculate Cosine Similarity
   *
   * @param a - First vector
   * @param b - Second vector
   * @returns Similarity (0.0 ~ 1.0)
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
