/**
 * PKMSemanticSearchAdapter
 * PKM Note Recommender 플러그인의 임베딩 서비스를 활용하는 어댑터
 *
 * 다른 플러그인의 Public API를 통해 의미 기반 검색 기능을 제공합니다.
 */

import type { App } from 'obsidian';
import type {
  ISemanticSearchService,
  SemanticSearchResult,
} from '../../core/domain';

/**
 * PKM Note Recommender의 EmbeddingService 타입 정의
 * 실제 타입은 PKM Note Recommender에 있지만, 느슨한 결합을 위해 여기서 정의
 */
interface PKMSimilarityResult {
  noteId: string;
  notePath: string;
  similarity: number;
}

interface PKMEmbeddingService {
  findSimilarToContent(
    content: string,
    options?: {
      limit?: number;
      threshold?: number;
      excludeNoteIds?: string[];
    }
  ): Promise<PKMSimilarityResult[]>;
}

interface PKMNoteRecommenderPlugin {
  getEmbeddingService(): PKMEmbeddingService | null;
  isEmbeddingServiceReady(): boolean;
}

export class PKMSemanticSearchAdapter implements ISemanticSearchService {
  private app: App;
  private cachedPlugin: PKMNoteRecommenderPlugin | null = null;

  // 재시도 설정
  private discoveryAttempts = 0;
  private readonly maxDiscoveryAttempts = 5;
  private readonly baseDiscoveryDelay = 1000; // 1초

  // 초기화 상태
  private initializationPromise: Promise<boolean> | null = null;
  private isInitialized = false;

  // 상태 변경 콜백
  private onStatusChangeCallback?: (available: boolean) => void;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * 비동기 초기화 - 플러그인 로드 대기
   * 모바일에서 플러그인 로드 순서가 다를 수 있어 재시도 로직 포함
   */
  async initialize(): Promise<boolean> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.waitForPlugin();
    return this.initializationPromise;
  }

  /**
   * 플러그인 로드를 기다리며 재시도
   * 플러그인 객체뿐만 아니라 임베딩 서비스가 준비될 때까지 대기
   */
  private async waitForPlugin(): Promise<boolean> {
    while (this.discoveryAttempts < this.maxDiscoveryAttempts) {
      const plugin = this.discoverPlugin();

      // 플러그인이 존재하고 임베딩 서비스가 준비됐는지 확인
      if (plugin && plugin.isEmbeddingServiceReady()) {
        this.cachedPlugin = plugin;
        this.isInitialized = true;
        console.log('[PKMSemanticSearchAdapter] PKM plugin discovered and embedding service ready');
        this.notifyStatusChange(true);
        return true;
      }

      this.discoveryAttempts++;
      const status = plugin ? 'plugin found but embedding not ready' : 'plugin not found';
      console.log(
        `[PKMSemanticSearchAdapter] Attempt ${this.discoveryAttempts}/${this.maxDiscoveryAttempts} - ${status}`
      );

      if (this.discoveryAttempts < this.maxDiscoveryAttempts) {
        // 점진적 지연: 1s → 2s → 3s → 4s
        await this.delay(this.baseDiscoveryDelay * this.discoveryAttempts);
      }
    }

    // 최대 시도 후에도 실패하면, 플러그인만이라도 캐시 (나중에 임베딩이 준비될 수 있음)
    const plugin = this.discoverPlugin();
    if (plugin) {
      this.cachedPlugin = plugin;
      console.warn('[PKMSemanticSearchAdapter] PKM plugin found but embedding service not ready after max attempts');
    } else {
      console.warn('[PKMSemanticSearchAdapter] PKM Note Recommender not found after max attempts');
    }

    this.isInitialized = true;
    this.notifyStatusChange(false);
    return false;
  }

  /**
   * 플러그인 발견 (즉시 시도)
   */
  private discoverPlugin(): PKMNoteRecommenderPlugin | null {
    const plugins = (this.app as any).plugins?.plugins;
    if (!plugins) {
      return null;
    }

    const pkmPlugin = plugins['pkm-note-recommender'] as PKMNoteRecommenderPlugin | undefined;
    if (pkmPlugin && typeof pkmPlugin.getEmbeddingService === 'function') {
      return pkmPlugin;
    }
    return null;
  }

  /**
   * 지연 실행 유틸리티
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 상태 변경 콜백 등록
   */
  setOnStatusChange(callback: (available: boolean) => void): void {
    this.onStatusChangeCallback = callback;
  }

  /**
   * 상태 변경 알림
   */
  private notifyStatusChange(available: boolean): void {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(available);
    }
  }

  /**
   * PKM Note Recommender 플러그인 참조 가져오기 (캐시 우선)
   */
  private getPlugin(): PKMNoteRecommenderPlugin | null {
    if (this.cachedPlugin) {
      return this.cachedPlugin;
    }

    // 초기화가 완료되지 않았어도 한번 더 시도
    const plugin = this.discoverPlugin();
    if (plugin) {
      this.cachedPlugin = plugin;
      return plugin;
    }

    return null;
  }

  /**
   * 서비스 사용 가능 여부 확인
   */
  isAvailable(): boolean {
    const plugin = this.getPlugin();
    if (!plugin) {
      console.log('[PKMSemanticSearchAdapter] isAvailable: false (plugin not found)');
      return false;
    }
    const ready = plugin.isEmbeddingServiceReady();
    console.log('[PKMSemanticSearchAdapter] isAvailable:', ready, '(embedding service ready:', ready, ')');
    return ready;
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
    const plugin = this.getPlugin();
    if (!plugin) {
      console.warn('[PKMSemanticSearchAdapter] PKM Note Recommender plugin not found');
      return [];
    }

    const embeddingService = plugin.getEmbeddingService();
    if (!embeddingService) {
      console.warn('[PKMSemanticSearchAdapter] Embedding service not available');
      return [];
    }

    try {
      const results = await embeddingService.findSimilarToContent(content, {
        limit: options?.limit ?? 10,
        threshold: options?.threshold ?? 0.5,
        excludeNoteIds: options?.excludeNoteIds,
      });

      return results.map((r) => ({
        noteId: r.noteId,
        notePath: r.notePath,
        similarity: r.similarity,
      }));
    } catch (error) {
      console.error('[PKMSemanticSearchAdapter] Error finding similar notes:', error);
      return [];
    }
  }

  /**
   * 여러 개념에 대해 일괄 검색
   *
   * @param concepts - 검색할 개념 목록
   * @param options - 검색 옵션
   * @returns 개념별 검색 결과 맵
   */
  async findNotesForConcepts(
    concepts: string[],
    options?: {
      limitPerConcept?: number;
      threshold?: number;
      excludeNoteIds?: string[];
    }
  ): Promise<Map<string, SemanticSearchResult[]>> {
    const results = new Map<string, SemanticSearchResult[]>();

    if (!this.isAvailable()) {
      // 서비스 불가능 시 빈 결과 반환
      for (const concept of concepts) {
        results.set(concept, []);
      }
      return results;
    }

    // 각 개념에 대해 병렬로 검색
    const searchPromises = concepts.map(async (concept) => {
      const found = await this.findSimilarToContent(concept, {
        limit: options?.limitPerConcept ?? 5,
        threshold: options?.threshold ?? 0.6,
        excludeNoteIds: options?.excludeNoteIds,
      });
      return { concept, found };
    });

    const searchResults = await Promise.all(searchPromises);

    for (const { concept, found } of searchResults) {
      results.set(concept, found);
    }

    return results;
  }
}
