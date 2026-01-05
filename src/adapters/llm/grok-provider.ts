/**
 * Grok LLM Provider
 * xAI Grok API 구현 (OpenAI 호환 API)
 */

import {
  LLMMessage,
  LLMGenerateOptions,
  LLMResponse,
  AIProviderType,
  AI_PROVIDERS,
} from '../../core/domain';
import { BaseProvider } from './base-provider';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokResponse {
  choices: Array<{
    message: { content: string };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: { message: string };
}

export class GrokProvider extends BaseProvider {
  readonly name = 'xAI Grok';
  readonly providerType: AIProviderType = 'grok';

  constructor() {
    super();
    this.model = AI_PROVIDERS.grok.defaultModel;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      return { success: false, content: '', error: 'API 키가 설정되지 않았습니다.' };
    }

    try {
      const grokMessages: GrokMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const requestBody: Record<string, unknown> = {
        model: this.model,
        messages: grokMessages,
        max_tokens: options?.maxTokens || 4096,
      };

      if (options?.temperature !== undefined) {
        requestBody.temperature = options.temperature;
      }

      if (options?.topP !== undefined) {
        requestBody.top_p = options.topP;
      }

      if (options?.stopSequences) {
        requestBody.stop = options.stopSequences;
      }

      const response = await this.makeRequest<GrokResponse>({
        url: `${AI_PROVIDERS.grok.endpoint}/chat/completions`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.error) {
        return { success: false, content: '', error: response.error.message };
      }

      const content = response.choices?.[0]?.message?.content || '';
      return {
        success: true,
        content,
        usage: response.usage
          ? {
              inputTokens: response.usage.prompt_tokens,
              outputTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await this.makeRequest<GrokResponse>({
        url: `${AI_PROVIDERS.grok.endpoint}/chat/completions`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model || AI_PROVIDERS.grok.defaultModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      return !response.error && response.choices?.length > 0;
    } catch {
      return false;
    }
  }
}
