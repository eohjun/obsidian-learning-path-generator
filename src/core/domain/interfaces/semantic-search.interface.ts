/**
 * ISemanticSearchService Interface
 * Interface for semantic-based note search
 *
 * Port for integration with external embedding services like PKM Note Recommender
 */

export interface SemanticSearchResult {
  noteId: string;
  notePath: string;
  similarity: number; // 0.0 ~ 1.0
}

export interface ISemanticSearchService {
  /**
   * Check service availability
   */
  isAvailable(): boolean;

  /**
   * Search for notes similar to text content
   *
   * @param content - Text content to search (concepts, keywords, etc.)
   * @param options - Search options
   * @returns List of notes sorted by similarity
   */
  findSimilarToContent(
    content: string,
    options?: {
      limit?: number;
      threshold?: number;
      excludeNoteIds?: string[];
    }
  ): Promise<SemanticSearchResult[]>;

  /**
   * Batch search for multiple concepts
   *
   * @param concepts - List of concepts to search
   * @param options - Search options
   * @returns Map of search results per concept
   */
  findNotesForConcepts(
    concepts: string[],
    options?: {
      limitPerConcept?: number;
      threshold?: number;
      excludeNoteIds?: string[];
    }
  ): Promise<Map<string, SemanticSearchResult[]>>;
}
