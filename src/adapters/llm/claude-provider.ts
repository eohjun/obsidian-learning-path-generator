/**
 * Claude Provider — 공유 빌더/파서 사용
 *
 * 추가: Extended thinking 지원 (Opus 4.6, Sonnet 4.6)
 * 수정: Thinking 블록 필터링, thinking 시 temperature 자동 차단
 */

import {
  LLMMessage,
  LLMGenerateOptions,
  LLMResponse,
  AIProviderType,
  AI_PROVIDERS,
} from '../../core/domain';
import { BaseProvider } from './base-provider';
import { buildAnthropicBody, parseAnthropicResponse } from 'obsidian-llm-shared';

export class ClaudeProvider extends BaseProvider {
  readonly name = 'Anthropic Claude';
  readonly providerType: AIProviderType = 'claude';

  constructor() {
    super();
    this.model = AI_PROVIDERS.claude.defaultModel;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      return { success: false, content: '', error: 'API key not configured.' };
    }

    try {
      const body = buildAnthropicBody(messages, this.model, {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      });

      if (options?.topP !== undefined) body.top_p = options.topP;
      if (options?.stopSequences) body.stop_sequences = options.stopSequences;

      const json = await this.makeRequest<Record<string, unknown>>({
        url: `${AI_PROVIDERS.claude.endpoint}/messages`,
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = parseAnthropicResponse(json);
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
        url: `${AI_PROVIDERS.claude.endpoint}/models`,
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });
      return Array.isArray(json?.data);
    } catch {
      return false;
    }
  }
}
