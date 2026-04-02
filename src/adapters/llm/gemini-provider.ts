/**
 * Gemini Provider — 공유 빌더/파서 사용
 */

import {
  LLMMessage,
  LLMGenerateOptions,
  LLMResponse,
  AIProviderType,
  AI_PROVIDERS,
} from '../../core/domain';
import { BaseProvider } from './base-provider';
import { buildGeminiBody, parseGeminiResponse, getGeminiGenerateUrl } from 'obsidian-llm-shared';

export class GeminiProvider extends BaseProvider {
  readonly name = 'Google Gemini';
  readonly providerType: AIProviderType = 'gemini';

  constructor() {
    super();
    this.model = AI_PROVIDERS.gemini.defaultModel;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      return { success: false, content: '', error: 'API key not configured.' };
    }

    try {
      const body = buildGeminiBody(messages, this.model, {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      });

      const genConfig = body.generationConfig as Record<string, unknown> | undefined;
      if (genConfig) {
        if (options?.topP !== undefined) genConfig.topP = options.topP;
        if (options?.stopSequences) genConfig.stopSequences = options.stopSequences;
      }

      const url = getGeminiGenerateUrl(this.model, this.apiKey, AI_PROVIDERS.gemini.endpoint);

      const json = await this.makeRequest<Record<string, unknown>>({
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = parseGeminiResponse(json);
      if (!result.success) {
        return { success: false, content: '', error: result.error };
      }

      return {
        success: true,
        content: result.text,
        usage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const json = await this.makeRequest<{ models?: unknown[] }>({
        url: `${AI_PROVIDERS.gemini.endpoint}/models?key=${apiKey}`,
        method: 'GET',
      });
      return Array.isArray(json?.models);
    } catch {
      return false;
    }
  }
}
