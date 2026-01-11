/**
 * IEmbeddingProvider Interface
 *
 * Embedding provider interface for converting text to vectors.
 * Abstracts various embedding APIs such as OpenAI, Claude, etc.
 */

/**
 * Embedding vector with metadata
 */
export interface EmbeddingVector {
  /** Note identifier (basename) */
  noteId: string;
  /** Note file path */
  notePath: string;
  /** Embedding vector */
  vector: number[];
  /** Original text (for debugging) */
  content: string;
}

/**
 * Embedding provider interface
 */
export interface IEmbeddingProvider {
  /**
   * Convert single text to vector
   *
   * @param text - Text to embed
   * @returns Embedding vector array
   */
  embed(text: string): Promise<number[]>;

  /**
   * Convert multiple texts in batch
   *
   * @param texts - Array of texts to embed
   * @returns Array of embedding vector arrays
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Check provider availability
   *
   * @returns true if API key is configured and available
   */
  isAvailable(): boolean;

  /**
   * Get embedding vector dimensions
   *
   * @returns Vector dimensions (e.g., OpenAI text-embedding-3-small = 1536)
   */
  getDimensions(): number;
}
