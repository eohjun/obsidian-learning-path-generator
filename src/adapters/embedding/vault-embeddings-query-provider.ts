/**
 * VaultEmbeddingsQueryProvider
 *
 * Vault Embeddings 플러그인의 임베딩 프로바이더를 사용하는 어댑터.
 * VE가 사용하는 것과 동일한 모델/차원으로 쿼리 벡터를 생성하여
 * 저장된 임베딩과의 유사도 검색이 정상 동작하도록 보장.
 */

import { App } from 'obsidian';
import type { IEmbeddingProvider } from '../../core/domain';

export class VaultEmbeddingsQueryProvider implements IEmbeddingProvider {
  private app: App;
  private cachedDimensions: number = 0;

  constructor(app: App) {
    this.app = app;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getVEPlugin(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.app as any).plugins?.plugins?.['vault-embeddings'];
  }

  isAvailable(): boolean {
    const ve = this.getVEPlugin();
    return !!ve?.embedQuery && !!ve?.getProviderInfo;
  }

  getDimensions(): number {
    if (this.cachedDimensions > 0) return this.cachedDimensions;
    const ve = this.getVEPlugin();
    const info = ve?.getProviderInfo?.();
    if (info?.dimensions) {
      this.cachedDimensions = info.dimensions;
    }
    return this.cachedDimensions || 0;
  }

  async embed(text: string): Promise<number[]> {
    const ve = this.getVEPlugin();
    if (!ve?.embedQuery) {
      throw new Error('Vault Embeddings plugin not available or outdated (requires v0.3.2+)');
    }
    return ve.embedQuery(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }
}
