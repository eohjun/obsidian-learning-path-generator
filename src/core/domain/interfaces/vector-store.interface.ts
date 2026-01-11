/**
 * IVectorStore Interface
 *
 * Storage interface for storing embedding vectors and performing similarity search.
 * Abstracts various storage backends such as In-Memory, IndexedDB, etc.
 */

import type { EmbeddingVector } from './embedding-provider.interface';

/**
 * Vector search result
 */
export interface VectorSearchResult {
  /** Note identifier */
  noteId: string;
  /** Note file path */
  notePath: string;
  /** Similarity score (0.0 ~ 1.0) */
  similarity: number;
}

/**
 * Vector search options
 */
export interface VectorSearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Minimum similarity threshold (0.0 ~ 1.0) */
  threshold?: number;
  /** List of note IDs to exclude */
  excludeNoteIds?: string[];
}

/**
 * Vector store interface
 */
export interface IVectorStore {
  /**
   * Store embedding vector
   *
   * @param embedding - Embedding vector to store
   */
  store(embedding: EmbeddingVector): void;

  /**
   * Search for similar vectors (Cosine Similarity)
   *
   * @param queryVector - Query vector for search
   * @param options - Search options
   * @returns Search results sorted by similarity
   */
  search(queryVector: number[], options?: VectorSearchOptions): VectorSearchResult[];

  /**
   * Get list of stored note IDs
   *
   * @returns All stored note IDs
   */
  getStoredNoteIds(): string[];

  /**
   * Remove embedding for a specific note
   *
   * @param noteId - Note ID to remove
   */
  remove(noteId: string): void;

  /**
   * Clear entire store
   */
  clear(): void;

  /**
   * Get number of stored vectors
   *
   * @returns Current number of stored embedding vectors
   */
  size(): number;

  /**
   * Check if embedding exists for a specific note
   *
   * @param noteId - Note ID to check
   * @returns true if embedding exists
   */
  has(noteId: string): boolean;
}
