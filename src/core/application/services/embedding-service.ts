/**
 * EmbeddingService
 *
 * 노트 임베딩 생성 및 유사도 검색을 조율하는 애플리케이션 서비스.
 * Domain 인터페이스만 의존하며, 구체적인 구현은 Adapter에서 주입받음.
 */

import type {
  IEmbeddingProvider,
  EmbeddingVector,
  IVectorStore,
  VectorSearchOptions,
  VectorSearchResult,
  INoteRepository,
  SemanticSearchResult,
} from '../../domain';

/**
 * 임베딩 서비스 설정
 */
export interface EmbeddingServiceConfig {
  /** 배치 임베딩 시 최대 크기 */
  batchSize?: number;
  /** 노트 내용 최대 길이 (토큰 절약) */
  maxContentLength?: number;
}

/**
 * 임베딩 진행 상태
 */
export interface EmbeddingProgress {
  current: number;
  total: number;
  phase: 'preparing' | 'embedding' | 'complete';
}

/**
 * 임베딩 통계
 */
export interface EmbeddingStats {
  totalNotes: number;
  embeddedNotes: number;
  pendingNotes: number;
  isIndexing: boolean;
}

/**
 * 진행 콜백 타입
 */
export type ProgressCallback = (progress: EmbeddingProgress) => void;

const DEFAULT_CONFIG: Required<EmbeddingServiceConfig> = {
  batchSize: 10,
  maxContentLength: 8000,
};

/**
 * 임베딩 서비스
 *
 * 노트 임베딩 생성, 저장, 검색을 조율하는 서비스.
 */
export class EmbeddingService {
  private config: Required<EmbeddingServiceConfig>;
  private isIndexing = false;

  constructor(
    private embeddingProvider: IEmbeddingProvider,
    private vectorStore: IVectorStore,
    private noteRepository: INoteRepository,
    config?: EmbeddingServiceConfig
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 서비스 사용 가능 여부
   */
  isAvailable(): boolean {
    return this.embeddingProvider.isAvailable();
  }

  /**
   * 단일 노트 임베딩 생성 및 저장
   *
   * @param noteId - 임베딩할 노트 ID
   * @returns 성공 여부
   */
  async embedNote(noteId: string): Promise<boolean> {
    if (!this.isAvailable()) {
      console.warn('[EmbeddingService] Provider not available');
      return false;
    }

    try {
      const note = await this.noteRepository.getNote(noteId);
      if (!note) {
        console.warn(`[EmbeddingService] Note not found: ${noteId}`);
        return false;
      }

      // 임베딩용 텍스트 준비 (제목 + 내용)
      const text = this.prepareTextForEmbedding(note.basename, note.content);
      const vector = await this.embeddingProvider.embed(text);

      const embedding: EmbeddingVector = {
        noteId: note.id,
        notePath: note.path,
        vector,
        content: text.slice(0, 500), // 디버깅용 (처음 500자만)
      };

      this.vectorStore.store(embedding);
      return true;
    } catch (error) {
      console.error(`[EmbeddingService] Failed to embed note ${noteId}:`, error);
      return false;
    }
  }

  /**
   * 여러 노트 배치 임베딩
   *
   * @param noteIds - 임베딩할 노트 ID 목록
   * @returns 성공한 노트 수
   */
  async embedNotes(noteIds: string[]): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    let successCount = 0;
    const batches = this.chunk(noteIds, this.config.batchSize);

    for (const batch of batches) {
      const notes = await Promise.all(
        batch.map(id => this.noteRepository.getNote(id))
      );

      const validNotes = notes.filter((n): n is NonNullable<typeof n> => n !== null);
      if (validNotes.length === 0) continue;

      try {
        const texts = validNotes.map(n =>
          this.prepareTextForEmbedding(n.basename, n.content)
        );
        const vectors = await this.embeddingProvider.embedBatch(texts);

        for (let i = 0; i < validNotes.length; i++) {
          const note = validNotes[i];
          const embedding: EmbeddingVector = {
            noteId: note.id,
            notePath: note.path,
            vector: vectors[i],
            content: texts[i].slice(0, 500),
          };
          this.vectorStore.store(embedding);
          successCount++;
        }
      } catch (error) {
        console.error('[EmbeddingService] Batch embedding failed:', error);
      }
    }

    return successCount;
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
    if (!this.isAvailable()) {
      return [];
    }

    try {
      // 쿼리 임베딩 생성
      const queryVector = await this.embeddingProvider.embed(query);

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
   * 모든 임베딩 초기화
   */
  clearAllEmbeddings(): void {
    this.vectorStore.clear();
  }

  /**
   * 특정 노트 임베딩 삭제
   */
  removeEmbedding(noteId: string): void {
    this.vectorStore.remove(noteId);
  }

  /**
   * 전체 노트 인덱싱
   *
   * @param excludeFolders - 제외할 폴더 목록
   * @param onProgress - 진행 콜백
   * @returns 임베딩된 노트 수
   */
  async indexAllNotes(
    excludeFolders?: string[],
    onProgress?: ProgressCallback
  ): Promise<number> {
    if (!this.isAvailable()) {
      console.warn('[EmbeddingService] Provider not available for indexing');
      return 0;
    }

    if (this.isIndexing) {
      console.warn('[EmbeddingService] Already indexing');
      return 0;
    }

    this.isIndexing = true;

    try {
      // 1. 전체 노트 목록 조회
      onProgress?.({ current: 0, total: 0, phase: 'preparing' });

      console.log(`[EmbeddingService] Calling getAllNotes with excludeFolders:`, excludeFolders);

      const allNotes = await this.noteRepository.getAllNotes({
        excludeFolders,
      });

      const totalNotes = allNotes.length;
      console.log(`[EmbeddingService] getAllNotes returned ${totalNotes} notes`);
      if (totalNotes === 0) {
        console.warn('[EmbeddingService] WARNING: No notes found! Check excludeFolders or vault state.');
      }
      console.log(`[EmbeddingService] Starting indexing of ${totalNotes} notes`);

      // 2. 이미 임베딩된 노트 제외
      const notesToEmbed = allNotes.filter(note => !this.hasEmbedding(note.id));
      const toEmbedCount = notesToEmbed.length;

      if (toEmbedCount === 0) {
        console.log('[EmbeddingService] All notes already embedded');
        onProgress?.({ current: totalNotes, total: totalNotes, phase: 'complete' });
        return 0;
      }

      console.log(`[EmbeddingService] ${toEmbedCount} notes need embedding`);

      // 3. 배치 임베딩
      let successCount = 0;
      const batches = this.chunk(notesToEmbed, this.config.batchSize);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        try {
          const texts = batch.map(note =>
            this.prepareTextForEmbedding(note.basename, note.content)
          );
          const vectors = await this.embeddingProvider.embedBatch(texts);

          for (let i = 0; i < batch.length; i++) {
            const note = batch[i];
            const vector = vectors[i];

            // 빈 벡터는 건너뛰기 (빈 텍스트로 인해 임베딩되지 않은 경우)
            if (!vector || vector.length === 0) {
              console.warn(`[EmbeddingService] Skipping empty embedding for: ${note.id}`);
              continue;
            }

            const embedding: EmbeddingVector = {
              noteId: note.id,
              notePath: note.path,
              vector,
              content: texts[i].slice(0, 500),
            };
            this.vectorStore.store(embedding);
            successCount++;
          }

          // 진행 상태 업데이트
          const processed = (batchIndex + 1) * this.config.batchSize;
          onProgress?.({
            current: Math.min(processed, toEmbedCount),
            total: toEmbedCount,
            phase: 'embedding',
          });
        } catch (error) {
          console.error(`[EmbeddingService] Batch ${batchIndex + 1} failed:`, error);
          // 실패한 배치는 건너뛰고 계속 진행
        }

        // Rate limiting + UI 리페인트를 위한 딜레이
        // setTimeout(0)으로 이벤트 루프에 양보하여 브라우저가 DOM 업데이트를 렌더링할 기회 제공
        await this.yieldToEventLoop();
        if (batchIndex < batches.length - 1) {
          await this.delay(50);
        }
      }

      console.log(`[EmbeddingService] Indexing complete: ${successCount}/${toEmbedCount} notes`);
      onProgress?.({ current: toEmbedCount, total: toEmbedCount, phase: 'complete' });

      return successCount;
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * 임베딩 통계 조회
   * 실제 노트와 매칭되는 임베딩만 카운트
   */
  async getStats(excludeFolders?: string[]): Promise<EmbeddingStats> {
    const allNotes = await this.noteRepository.getAllNotes({ excludeFolders });

    // 실제 노트와 매칭되는 임베딩만 카운트
    let embeddedCount = 0;
    for (const note of allNotes) {
      if (this.hasEmbedding(note.id)) {
        embeddedCount++;
      }
    }

    return {
      totalNotes: allNotes.length,
      embeddedNotes: embeddedCount,
      pendingNotes: allNotes.length - embeddedCount,
      isIndexing: this.isIndexing,
    };
  }

  /**
   * 현재 인덱싱 중인지 확인
   */
  isCurrentlyIndexing(): boolean {
    return this.isIndexing;
  }

  /**
   * 딜레이 유틸리티
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 이벤트 루프에 양보하여 브라우저가 렌더링할 기회 제공
   * double requestAnimationFrame 패턴 사용:
   * - 첫 번째 rAF: 다음 repaint 전에 실행
   * - 두 번째 rAF: 실제 repaint 후에 실행
   */
  private yieldToEventLoop(): Promise<void> {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  }

  /**
   * 임베딩용 텍스트 준비
   */
  private prepareTextForEmbedding(title: string, content: string): string {
    const fullText = `${title}\n\n${content}`;
    if (fullText.length <= this.config.maxContentLength) {
      return fullText;
    }
    return fullText.slice(0, this.config.maxContentLength);
  }

  /**
   * 배열을 청크로 분할
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
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
  noteRepository: INoteRepository,
  config?: EmbeddingServiceConfig
): EmbeddingService {
  embeddingServiceInstance = new EmbeddingService(
    embeddingProvider,
    vectorStore,
    noteRepository,
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
  if (embeddingServiceInstance) {
    embeddingServiceInstance.clearAllEmbeddings();
    embeddingServiceInstance = null;
  }
}
