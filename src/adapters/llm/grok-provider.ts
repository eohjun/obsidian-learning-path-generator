/**
 * Grok Provider — 공유 빌더/파서 사용
 *
 * 추가: Reasoning 모델 지원 (grok-4-1-fast)
 */

import {
  LLMMessage,
  LLMGenerateOptions,
  LLMResponse,
  AIProviderType,
  AI_PROVIDERS,
} from '../../core/domain';
import { BaseProvider } from './base-provider';
import { buildGrokBody, parseGrokResponse } from 'obsidian-llm-shared';

export class GrokProvider extends BaseProvider {
  readonly name = 'xAI Grok';
  readonly providerType: AIProviderType = 'grok';

  constructor() {
    super();
    this.model = AI_PROVIDERS.grok.defaultModel;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      return { success: false, content: '', error: 'API key not configured.' };
    }

    try {
      const body = buildGrokBody(messages, this.model, {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      });

      if (options?.topP !== undefined) body.top_p = options.topP;
      if (options?.stopSequences) body.stop = options.stopSequences;

      const json = await this.makeRequest<Record<string, unknown>>({
        url: `${AI_PROVIDERS.grok.endpoint}/chat/completions`,
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = parseGrokResponse(json);
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
      const json = await this.makeRequest<{ data?: unknown[] }>({
        url: `${AI_PROVIDERS.grok.endpoint}/models`,
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return Array.isArray(json?.data);
    } catch {
      return false;
    }
  }
}
