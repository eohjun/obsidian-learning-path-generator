/**
 * OpenAI Provider — 공유 빌더/파서 사용
 *
 * 수정된 버그: temperature가 reasoning 모델에도 전송되던 문제 해결
 */

import {
  LLMMessage,
  LLMGenerateOptions,
  LLMResponse,
  AIProviderType,
  AI_PROVIDERS,
} from '../../core/domain';
import { BaseProvider } from './base-provider';
import { buildOpenAIBody, parseOpenAIResponse } from 'obsidian-llm-shared';

export class OpenAIProvider extends BaseProvider {
  readonly name = 'OpenAI GPT';
  readonly providerType: AIProviderType = 'openai';

  constructor() {
    super();
    this.model = AI_PROVIDERS.openai.defaultModel;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      return { success: false, content: '', error: 'API key not configured.' };
    }

    try {
      const body = buildOpenAIBody(messages, this.model, {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      });

      if (options?.topP !== undefined) body.top_p = options.topP;
      if (options?.stopSequences) body.stop = options.stopSequences;

      const json = await this.makeRequest<Record<string, unknown>>({
        url: `${AI_PROVIDERS.openai.endpoint}/chat/completions`,
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = parseOpenAIResponse(json);
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
      const body = buildOpenAIBody(
        [{ role: 'user', content: 'Hello' }],
        this.model || AI_PROVIDERS.openai.defaultModel,
        { maxTokens: 10 }
      );
      const json = await this.makeRequest<Record<string, unknown>>({
        url: `${AI_PROVIDERS.openai.endpoint}/chat/completions`,
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return parseOpenAIResponse(json).success;
    } catch {
      return false;
    }
  }
}
