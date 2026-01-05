/**
 * ISemanticSearchService Interface
 * 의미 기반 노트 검색을 위한 인터페이스
 *
 * PKM Note Recommender 등 외부 임베딩 서비스와 연동하기 위한 포트
 */

export interface SemanticSearchResult {
  noteId: string;
  notePath: string;
  similarity: number; // 0.0 ~ 1.0
}

export interface ISemanticSearchService {
  /**
   * 서비스 사용 가능 여부 확인
   */
  isAvailable(): boolean;

  /**
   * 텍스트 내용과 유사한 노트 검색
   *
   * @param content - 검색할 텍스트 내용 (개념, 키워드 등)
   * @param options - 검색 옵션
   * @returns 유사도 순으로 정렬된 노트 목록
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
   * 여러 개념에 대해 일괄 검색
   *
   * @param concepts - 검색할 개념 목록
   * @param options - 검색 옵션
   * @returns 개념별 검색 결과 맵
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
