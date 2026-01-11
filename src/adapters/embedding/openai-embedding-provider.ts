/**
 * OpenAIEmbeddingProvider
 *
 * Embedding provider using OpenAI text-embedding-3-small model.
 * Uses Obsidian's requestUrl to avoid CORS issues with API calls.
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
   * Check provider availability
   */
  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Get vector dimensions
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Convert single text to vector
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
        // Check error response content
        const errorBody = response.text || 'No response body';
        console.error('[OpenAIEmbeddingProvider] API error response:', errorBody);
        throw new Error(`OpenAI API error ${response.status}: ${errorBody.slice(0, 200)}`);
      }

      // Verify response before JSON parsing
      if (!response.text || response.text.length === 0) {
        throw new Error('OpenAI API returned empty response');
      }

      const data = response.json;
      if (!data?.data?.[0]?.embedding) {
        throw new Error(`Invalid API response structure: ${JSON.stringify(data).slice(0, 200)}`);
      }

      return data.data[0].embedding;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[OpenAIEmbeddingProvider] Embedding failed:', message);
      throw new Error(`Embedding failed: ${message}`);
    }
  }

  /**
   * Convert multiple texts in batch
   * Returns array of same length as input (empty texts get empty vectors)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isAvailable()) {
      throw new Error('[OpenAIEmbeddingProvider] API key not configured');
    }

    // Track empty text indices
    const cleanedTexts = texts.map(t => this.cleanText(t));
    const nonEmptyIndices: number[] = [];
    const textsToEmbed: string[] = [];

    for (let i = 0; i < cleanedTexts.length; i++) {
      if (cleanedTexts[i].length > 0) {
        nonEmptyIndices.push(i);
        textsToEmbed.push(cleanedTexts[i]);
      }
    }

    if (textsToEmbed.length === 0) {
      // Return empty vector array if all texts are empty
      return texts.map(() => []);
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
          input: textsToEmbed,
          dimensions: this.dimensions,
        }),
      });

      if (response.status !== 200) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = response.json;
      // Extract vectors in response order
      const embeddings = data.data
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((item: { embedding: number[] }) => item.embedding);

      // Reconstruct to same length as original array (empty texts get empty vectors)
      const result: number[][] = texts.map(() => []);
      for (let i = 0; i < nonEmptyIndices.length; i++) {
        result[nonEmptyIndices[i]] = embeddings[i];
      }

      return result;
    } catch (error) {
      console.error('[OpenAIEmbeddingProvider] Batch embedding failed:', error);
      throw error;
    }
  }

  /**
   * Text preprocessing
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')  // Remove consecutive whitespace
      .trim()
      .slice(0, 8000);  // Token limit (approximately 8000 characters)
  }
}
