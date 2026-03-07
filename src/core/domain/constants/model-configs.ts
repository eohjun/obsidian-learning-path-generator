/**
 * Model Configurations
 * AI Provider and model settings
 */

import { AIProviderType } from '../interfaces/llm-provider.interface';

export interface AIProviderConfig {
  id: AIProviderType;
  name: string;
  displayName: string;
  endpoint: string;
  defaultModel: string;
  apiKeyPrefix?: string;
}

export interface ModelConfig {
  id: string;
  displayName: string;
  provider: AIProviderType;
  maxTokens: number;
  inputCostPer1M?: number;
  outputCostPer1M?: number;
}

export const AI_PROVIDERS: Record<AIProviderType, AIProviderConfig> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    displayName: 'Anthropic Claude',
    endpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-6',
    apiKeyPrefix: 'sk-ant-',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    displayName: 'OpenAI GPT',
    endpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5-mini',
    apiKeyPrefix: 'sk-',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    displayName: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    apiKeyPrefix: 'AIza',
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    displayName: 'xAI Grok',
    endpoint: 'https://api.x.ai/v1',
    defaultModel: 'grok-4-1-fast',
  },
};

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // Claude models
  'claude-opus-4-6': {
    id: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    provider: 'claude',
    maxTokens: 128000,
    inputCostPer1M: 5.0,
    outputCostPer1M: 25.0,
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    provider: 'claude',
    maxTokens: 64000,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  'claude-haiku-4-5-20251001': {
    id: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    provider: 'claude',
    maxTokens: 64000,
    inputCostPer1M: 1.0,
    outputCostPer1M: 5.0,
  },

  // OpenAI models
  'gpt-5.4': {
    id: 'gpt-5.4',
    displayName: 'GPT-5.4',
    provider: 'openai',
    maxTokens: 128000,
    inputCostPer1M: 2.5,
    outputCostPer1M: 15.0,
  },
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    displayName: 'GPT-5 Mini',
    provider: 'openai',
    maxTokens: 128000,
    inputCostPer1M: 0.25,
    outputCostPer1M: 2.0,
  },
  'gpt-5-nano': {
    id: 'gpt-5-nano',
    displayName: 'GPT-5 Nano',
    provider: 'openai',
    maxTokens: 128000,
    inputCostPer1M: 0.05,
    outputCostPer1M: 0.4,
  },

  // Gemini models
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro',
    provider: 'gemini',
    maxTokens: 65536,
    inputCostPer1M: 2.0,
    outputCostPer1M: 12.0,
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'gemini',
    maxTokens: 65536,
    inputCostPer1M: 0.3,
    outputCostPer1M: 2.5,
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'gemini',
    maxTokens: 8192,
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
  },

  // Grok models
  'grok-4-1-fast': {
    id: 'grok-4-1-fast',
    displayName: 'Grok 4.1 Fast',
    provider: 'grok',
    maxTokens: 16384,
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.5,
  },
  'grok-4-1-fast-non-reasoning': {
    id: 'grok-4-1-fast-non-reasoning',
    displayName: 'Grok 4.1 Fast (Non-Reasoning)',
    provider: 'grok',
    maxTokens: 16384,
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.5,
  },
};

export function getModelsByProvider(provider: AIProviderType): ModelConfig[] {
  return Object.values(MODEL_CONFIGS).filter((m) => m.provider === provider);
}

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_CONFIGS[modelId];
}
