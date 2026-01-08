/**
 * VaultEmbeddingsVectorStore
 *
 * Vault Embeddings 플러그인에서 생성한 임베딩 데이터를 읽어오는 read-only 벡터 저장소.
 * 노트 임베딩 생성/저장은 Vault Embeddings 플러그인이 담당하고,
 * 이 클래스는 해당 데이터를 읽어와 유사도 검색만 수행.
 */

import { App, TFile, normalizePath } from 'obsidian';
import type {
  IVectorStore,
  EmbeddingVector,
  VectorSearchResult,
  VectorSearchOptions,
} from '../../core/domain';

/**
 * Vault Embeddings index.json 구조 (09_Embedded/index.json)
 */
interface VaultEmbeddingIndex {
  version: string;
  totalNotes: number;
  lastUpdated: string;
  model: string;
  dimensions: number;
  notes: {
    [noteId: string]: {
      path: string;
      contentHash: string;
      updatedAt: string;
    };
  };
}

/**
 * Vault Embeddings 개별 임베딩 파일 구조 (09_Embedded/embeddings/<noteId>.json)
 */
interface SerializedNoteEmbedding {
  noteId: string;
  notePath: string;
  title: string;
  contentHash: string;
  vector: number[];
  model: string;
  provider: string;
  dimensions: number;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_THRESHOLD = 0.3;
const CACHE_TTL_MS = 60000; // 1분 캐시

export interface VaultEmbeddingsVectorStoreConfig {
  /** Vault Embeddings 저장 경로 (기본값: '09_Embedded') */
  storagePath?: string;
  /** 임베딩 폴더 이름 (기본값: 'embeddings') */
  embeddingsFolder?: string;
}

export class VaultEmbeddingsVectorStore implements IVectorStore {
  private app: App;
  private config: Required<VaultEmbeddingsVectorStoreConfig>;
  private cache: Map<string, EmbeddingVector> = new Map();
  private indexCache: VaultEmbeddingIndex | null = null;
  private lastCacheUpdate = 0;
  private initialized = false;

  constructor(app: App, config?: VaultEmbeddingsVectorStoreConfig) {
    this.app = app;
    this.config = {
      storagePath: config?.storagePath ?? '09_Embedded',
      embeddingsFolder: config?.embeddingsFolder ?? 'embeddings',
    };
  }

  /**
   * 초기화 - 캐시 로드
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadAllEmbeddings();
      this.initialized = true;
      console.log(`[VaultEmbeddingsVectorStore] Initialized with ${this.cache.size} embeddings`);
    } catch (error) {
      console.error('[VaultEmbeddingsVectorStore] Initialization failed:', error);
      // 초기화 실패해도 계속 진행 (빈 캐시로)
      this.initialized = true;
    }
  }

  /**
   * 서비스 사용 가능 여부
   */
  isAvailable(): boolean {
    return this.cache.size > 0;
  }

  /**
   * 임베딩 통계 조회
   */
  async getStats(): Promise<{
    isAvailable: boolean;
    totalEmbeddings: number;
    model: string;
    provider: string;
  }> {
    await this.ensureCacheValid();

    return {
      isAvailable: this.isAvailable(),
      totalEmbeddings: this.cache.size,
      model: this.indexCache?.model ?? 'unknown',
      provider: 'openai', // Vault Embeddings는 OpenAI 사용
    };
  }

  /**
   * 캐시 강제 새로고침
   */
  async refresh(): Promise<void> {
    this.cache.clear();
    this.indexCache = null;
    this.lastCacheUpdate = 0;
    await this.loadAllEmbeddings();
    console.log(`[VaultEmbeddingsVectorStore] Cache refreshed: ${this.cache.size} embeddings`);
  }

  // ============================================================================
  // IVectorStore Implementation
  // ============================================================================

  /**
   * 임베딩 저장 - No-op (Vault Embeddings 플러그인이 담당)
   */
  store(_embedding: EmbeddingVector): void {
    console.info('[VaultEmbeddingsVectorStore] store() is no-op. Use Vault Embeddings plugin to manage embeddings.');
  }

  /**
   * 유사 벡터 검색 (Cosine Similarity)
   */
  search(queryVector: number[], options?: VectorSearchOptions): VectorSearchResult[] {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
    const excludeNoteIds = new Set(options?.excludeNoteIds ?? []);

    const results: VectorSearchResult[] = [];

    for (const [noteId, embedding] of this.cache) {
      if (excludeNoteIds.has(noteId)) {
        continue;
      }

      // 차원 불일치 시 스킵
      if (queryVector.length !== embedding.vector.length) {
        continue;
      }

      const similarity = this.cosineSimilarity(queryVector, embedding.vector);

      if (similarity >= threshold) {
        results.push({
          noteId,
          notePath: embedding.notePath,
          similarity,
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * 저장된 노트 ID 목록 조회
   */
  getStoredNoteIds(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 임베딩 삭제 - No-op
   */
  remove(_noteId: string): void {
    console.info('[VaultEmbeddingsVectorStore] remove() is no-op. Use Vault Embeddings plugin to manage embeddings.');
  }

  /**
   * 전체 초기화 - No-op
   */
  clear(): void {
    console.info('[VaultEmbeddingsVectorStore] clear() is no-op. Use Vault Embeddings plugin to manage embeddings.');
  }

  /**
   * 저장된 벡터 수
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 특정 노트의 임베딩 존재 여부 확인
   */
  has(noteId: string): boolean {
    return this.cache.has(noteId);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 캐시 유효성 확인 및 필요시 갱신
   */
  private async ensureCacheValid(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate > CACHE_TTL_MS) {
      await this.loadAllEmbeddings();
    }
  }

  /**
   * 모든 임베딩 파일 로드
   * adapter 폴백으로 Git 동기화 시 인덱스 불일치 문제 해결
   */
  private async loadAllEmbeddings(): Promise<void> {
    // 인덱스 파일 경로 (normalizePath로 플랫폼 간 호환성 확보)
    const indexPath = normalizePath(`${this.config.storagePath}/index.json`);

    try {
      // index.json 로드 (adapter 폴백)
      let indexContent: string;
      const indexFile = this.app.vault.getAbstractFileByPath(indexPath);
      if (indexFile instanceof TFile) {
        indexContent = await this.app.vault.read(indexFile);
      } else {
        // Obsidian 인덱스에 없으면 adapter로 직접 읽기 시도
        try {
          indexContent = await this.app.vault.adapter.read(indexPath);
          console.log(`[VaultEmbeddingsVectorStore] Used adapter.read for index`);
        } catch {
          console.warn(`[VaultEmbeddingsVectorStore] Index not found: ${indexPath}`);
          return;
        }
      }

      this.indexCache = JSON.parse(indexContent) as VaultEmbeddingIndex;

      // 임베딩 폴더 경로
      const embeddingsPath = normalizePath(`${this.config.storagePath}/${this.config.embeddingsFolder}`);

      // 인덱스에 있는 각 노트의 임베딩 파일 로드
      this.cache.clear();
      for (const noteId of Object.keys(this.indexCache.notes)) {
        // noteId를 안전한 파일명으로 변환 (Vault Embeddings와 동일한 방식)
        const safeId = noteId.replace(/[^a-zA-Z0-9-_]/g, '_');
        const embeddingFilePath = normalizePath(`${embeddingsPath}/${safeId}.json`);

        await this.loadEmbeddingFile(embeddingFilePath, noteId);
      }

      this.lastCacheUpdate = Date.now();
      console.log(`[VaultEmbeddingsVectorStore] Loaded ${this.cache.size} embeddings from Vault Embeddings`);
    } catch (error) {
      console.error('[VaultEmbeddingsVectorStore] Failed to load embeddings:', error);
    }
  }

  /**
   * 개별 임베딩 파일 로드 (adapter 폴백 지원)
   */
  private async loadEmbeddingFile(filePath: string, noteId: string): Promise<void> {
    try {
      let content: string;
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        content = await this.app.vault.read(file);
      } else {
        // adapter로 직접 읽기 시도
        try {
          content = await this.app.vault.adapter.read(filePath);
        } catch {
          return; // 파일 없음 - 스킵
        }
      }

      const data = JSON.parse(content) as SerializedNoteEmbedding;

      this.cache.set(noteId, {
        noteId: data.noteId,
        notePath: data.notePath,
        vector: data.vector,
        content: '', // Vault Embeddings는 원본 content를 저장하지 않음
      });
    } catch (error) {
      // 개별 파일 로드 실패는 경고만
      console.warn(`[VaultEmbeddingsVectorStore] Failed to load: ${filePath}`);
    }
  }

  /**
   * Cosine Similarity 계산
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
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
