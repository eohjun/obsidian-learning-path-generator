/**
 * Gemini LLM Provider
 * Google Gemini API 구현
 */

import {
  LLMMessage,
  LLMGenerateOptions,
  LLMResponse,
  AIProviderType,
  AI_PROVIDERS,
} from '../../core/domain';
import { BaseProvider } from './base-provider';

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  error?: { message: string };
}

export class GeminiProvider extends BaseProvider {
  readonly name = 'Google Gemini';
  readonly providerType: AIProviderType = 'gemini';

  constructor() {
    super();
    this.model = AI_PROVIDERS.gemini.defaultModel;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      return { success: false, content: '', error: 'API 키가 설정되지 않았습니다.' };
    }

    try {
      const { contents, systemInstruction } = this.convertMessages(messages);

      const requestBody: Record<string, unknown> = {
        contents,
        generationConfig: {
          maxOutputTokens: options?.maxTokens || 4096,
        },
      };

      if (systemInstruction) {
        requestBody.systemInstruction = systemInstruction;
      }

      if (options?.temperature !== undefined) {
        (requestBody.generationConfig as Record<string, unknown>).temperature = options.temperature;
      }

      if (options?.topP !== undefined) {
        (requestBody.generationConfig as Record<string, unknown>).topP = options.topP;
      }

      if (options?.stopSequences) {
        (requestBody.generationConfig as Record<string, unknown>).stopSequences = options.stopSequences;
      }

      const url = `${AI_PROVIDERS.gemini.endpoint}/models/${this.model}:generateContent?key=${this.apiKey}`;

      const response = await this.makeRequest<GeminiResponse>({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.error) {
        return { success: false, content: '', error: response.error.message };
      }

      const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return {
        success: true,
        content,
        usage: response.usageMetadata
          ? {
              inputTokens: response.usageMetadata.promptTokenCount,
              outputTokens: response.usageMetadata.candidatesTokenCount,
              totalTokens: response.usageMetadata.totalTokenCount,
            }
          : undefined,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const url = `${AI_PROVIDERS.gemini.endpoint}/models/${this.model || AI_PROVIDERS.gemini.defaultModel}:generateContent?key=${apiKey}`;

      const response = await this.makeRequest<GeminiResponse>({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });

      return !response.error && !!response.candidates?.length;
    } catch {
      return false;
    }
  }

  private convertMessages(messages: LLMMessage[]): {
    contents: GeminiContent[];
    systemInstruction: { parts: Array<{ text: string }> } | null;
  } {
    let systemInstruction: { parts: Array<{ text: string }> } | null = null;
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        if (systemInstruction) {
          systemInstruction.parts.push({ text: msg.content });
        } else {
          systemInstruction = { parts: [{ text: msg.content }] };
        }
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    return { contents, systemInstruction };
  }
}
