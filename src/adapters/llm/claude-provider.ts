/**
 * Claude LLM Provider
 * Anthropic Claude API implementation
 */

import {
  LLMMessage,
  LLMGenerateOptions,
  LLMResponse,
  AIProviderType,
  AI_PROVIDERS,
} from '../../core/domain';
import { BaseProvider } from './base-provider';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: { message: string };
}

export class ClaudeProvider extends BaseProvider {
  readonly name = 'Anthropic Claude';
  readonly providerType: AIProviderType = 'claude';
  private readonly API_VERSION = '2023-06-01';

  constructor() {
    super();
    this.model = AI_PROVIDERS.claude.defaultModel;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      return { success: false, content: '', error: 'API key not configured.' };
    }

    try {
      const { claudeMessages, systemPrompt } = this.convertMessages(messages);

      const requestBody: Record<string, unknown> = {
        model: this.model,
        max_tokens: options?.maxTokens || 4096,
        messages: claudeMessages,
      };

      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }

      if (options?.temperature !== undefined) {
        requestBody.temperature = options.temperature;
      }

      if (options?.topP !== undefined) {
        requestBody.top_p = options.topP;
      }

      if (options?.stopSequences) {
        requestBody.stop_sequences = options.stopSequences;
      }

      const response = await this.makeRequest<ClaudeResponse>({
        url: `${AI_PROVIDERS.claude.endpoint}/messages`,
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': this.API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.error) {
        return { success: false, content: '', error: response.error.message };
      }

      const content = response.content?.[0]?.text || '';
      return {
        success: true,
        content,
        usage: response.usage
          ? {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            }
          : undefined,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await this.makeRequest<ClaudeResponse>({
        url: `${AI_PROVIDERS.claude.endpoint}/messages`,
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': this.API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model || AI_PROVIDERS.claude.defaultModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      return !response.error && !!response.content;
    } catch {
      return false;
    }
  }

  private convertMessages(messages: LLMMessage[]): {
    claudeMessages: ClaudeMessage[];
    systemPrompt: string | null;
  } {
    let systemPrompt: string | null = null;
    const claudeMessages: ClaudeMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${msg.content}` : msg.content;
      } else {
        claudeMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    return { claudeMessages, systemPrompt };
  }
}
