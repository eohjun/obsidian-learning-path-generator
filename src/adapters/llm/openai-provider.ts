/**
 * OpenAI LLM Provider
 * OpenAI GPT API 구현
 */

import {
  LLMMessage,
  LLMGenerateOptions,
  LLMResponse,
  AIProviderType,
  AI_PROVIDERS,
} from '../../core/domain';
import { BaseProvider } from './base-provider';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
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

export class OpenAIProvider extends BaseProvider {
  readonly name = 'OpenAI GPT';
  readonly providerType: AIProviderType = 'openai';

  constructor() {
    super();
    this.model = AI_PROVIDERS.openai.defaultModel;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      return { success: false, content: '', error: 'API 키가 설정되지 않았습니다.' };
    }

    try {
      const openaiMessages: OpenAIMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const isReasoningModel =
        this.model.startsWith('o1') || this.model.startsWith('o3') || this.model.startsWith('gpt-5');

      const requestBody: Record<string, unknown> = {
        model: this.model,
        messages: openaiMessages,
      };

      if (isReasoningModel) {
        requestBody.max_completion_tokens = options?.maxTokens || 4096;
      } else {
        requestBody.max_tokens = options?.maxTokens || 4096;
        if (options?.temperature !== undefined) {
          requestBody.temperature = options.temperature;
        }
        if (options?.topP !== undefined) {
          requestBody.top_p = options.topP;
        }
      }

      if (options?.stopSequences) {
        requestBody.stop = options.stopSequences;
      }

      const response = await this.makeRequest<OpenAIResponse>({
        url: `${AI_PROVIDERS.openai.endpoint}/chat/completions`,
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
      const model = this.model || AI_PROVIDERS.openai.defaultModel;
      const isReasoningModel =
        model.startsWith('o1') || model.startsWith('o3') || model.startsWith('gpt-5');

      const requestBody: Record<string, unknown> = {
        model,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // GPT-5.x and o-series models use max_completion_tokens instead of max_tokens
      if (isReasoningModel) {
        requestBody.max_completion_tokens = 10;
      } else {
        requestBody.max_tokens = 10;
      }

      const response = await this.makeRequest<OpenAIResponse>({
        url: `${AI_PROVIDERS.openai.endpoint}/chat/completions`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      return !response.error && response.choices?.length > 0;
    } catch {
      return false;
    }
  }
}
