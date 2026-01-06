/**
 * OpenAIEmbeddingProvider
 *
 * OpenAI text-embedding-3-small 모델을 사용한 임베딩 프로바이더.
 * Obsidian의 requestUrl을 사용하여 CORS 문제 없이 API 호출.
 */

import { requestUrl } from 'obsidian';
import type { IEmbeddingProvider } from '../../core/domain';

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private apiKey: string;
  private model: string;
  private dimensions: number;

  constructor(apiKey: string, model?: string, dimensions?: number) {
    this.apiKey = apiKey;
    this.model = model ?? DEFAULT_MODEL;
    this.dimensions = dimensions ?? DEFAULT_DIMENSIONS;
  }

  /**
   * 프로바이더 사용 가능 여부
   */
  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * 벡터 차원 수
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * 단일 텍스트를 벡터로 변환
   */
  async embed(text: string): Promise<number[]> {
    if (!this.isAvailable()) {
      throw new Error('[OpenAIEmbeddingProvider] API key not configured');
    }

    const cleanedText = this.cleanText(text);
    if (!cleanedText) {
      throw new Error('[OpenAIEmbeddingProvider] Empty text provided');
    }

    try {
      const response = await requestUrl({
        url: OPENAI_EMBEDDING_URL,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: cleanedText,
          dimensions: this.dimensions,
        }),
      });

      if (response.status !== 200) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = response.json;
      return data.data[0].embedding;
    } catch (error) {
      console.error('[OpenAIEmbeddingProvider] Embedding failed:', error);
      throw error;
    }
  }

  /**
   * 여러 텍스트를 배치로 변환
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isAvailable()) {
      throw new Error('[OpenAIEmbeddingProvider] API key not configured');
    }

    const cleanedTexts = texts.map(t => this.cleanText(t)).filter(t => t.length > 0);
    if (cleanedTexts.length === 0) {
      return [];
    }

    try {
      const response = await requestUrl({
        url: OPENAI_EMBEDDING_URL,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: cleanedTexts,
          dimensions: this.dimensions,
        }),
      });

      if (response.status !== 200) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = response.json;
      // 응답 순서대로 벡터 추출
      return data.data
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((item: { embedding: number[] }) => item.embedding);
    } catch (error) {
      console.error('[OpenAIEmbeddingProvider] Batch embedding failed:', error);
      throw error;
    }
  }

  /**
   * 텍스트 전처리
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')  // 연속 공백 제거
      .trim()
      .slice(0, 8000);  // 토큰 제한 (대략 8000자)
  }
}
