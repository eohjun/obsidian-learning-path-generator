/**
 * IEmbeddingProvider Interface
 *
 * 텍스트를 벡터로 변환하는 임베딩 프로바이더 인터페이스.
 * OpenAI, Claude 등 다양한 임베딩 API를 추상화.
 */

/**
 * 임베딩된 벡터와 메타데이터
 */
export interface EmbeddingVector {
  /** 노트 식별자 (basename) */
  noteId: string;
  /** 노트 파일 경로 */
  notePath: string;
  /** 임베딩 벡터 */
  vector: number[];
  /** 원본 텍스트 (디버깅용) */
  content: string;
}

/**
 * 임베딩 프로바이더 인터페이스
 */
export interface IEmbeddingProvider {
  /**
   * 단일 텍스트를 벡터로 변환
   *
   * @param text - 임베딩할 텍스트
   * @returns 임베딩 벡터 배열
   */
  embed(text: string): Promise<number[]>;

  /**
   * 여러 텍스트를 배치로 변환
   *
   * @param texts - 임베딩할 텍스트 배열
   * @returns 임베딩 벡터 배열의 배열
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * 프로바이더 사용 가능 여부
   *
   * @returns API 키가 설정되어 있고 사용 가능하면 true
   */
  isAvailable(): boolean;

  /**
   * 임베딩 벡터의 차원 수
   *
   * @returns 벡터 차원 (예: OpenAI text-embedding-3-small = 1536)
   */
  getDimensions(): number;
}
