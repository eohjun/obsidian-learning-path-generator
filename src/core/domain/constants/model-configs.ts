/**
 * Model Configurations
 * AI Provider 및 모델 설정
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
  inputCostPer1k?: number;
  outputCostPer1k?: number;
}

export const AI_PROVIDERS: Record<AIProviderType, AIProviderConfig> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    displayName: 'Anthropic Claude',
    endpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    apiKeyPrefix: 'sk-ant-',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    displayName: 'OpenAI GPT',
    endpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    apiKeyPrefix: 'sk-',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    displayName: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    apiKeyPrefix: 'AIza',
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    displayName: 'xAI Grok',
    endpoint: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini-fast',
  },
};

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // Claude models
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    provider: 'claude',
    maxTokens: 8192,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
  },
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'claude',
    maxTokens: 8192,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
  },
  'claude-3-haiku-20240307': {
    id: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    provider: 'claude',
    maxTokens: 4096,
    inputCostPer1k: 0.00025,
    outputCostPer1k: 0.00125,
  },

  // OpenAI models
  'gpt-4o': {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    maxTokens: 16384,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    maxTokens: 16384,
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
  },
  'o1-mini': {
    id: 'o1-mini',
    displayName: 'o1 Mini',
    provider: 'openai',
    maxTokens: 65536,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.012,
  },

  // Gemini models
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'gemini',
    maxTokens: 8192,
    inputCostPer1k: 0.00025,
    outputCostPer1k: 0.001,
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    provider: 'gemini',
    maxTokens: 8192,
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
  },
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    provider: 'gemini',
    maxTokens: 8192,
    inputCostPer1k: 0.000075,
    outputCostPer1k: 0.0003,
  },

  // Grok models
  'grok-3-mini-fast': {
    id: 'grok-3-mini-fast',
    displayName: 'Grok 3 Mini Fast',
    provider: 'grok',
    maxTokens: 16384,
  },
  'grok-3-mini': {
    id: 'grok-3-mini',
    displayName: 'Grok 3 Mini',
    provider: 'grok',
    maxTokens: 16384,
  },
};

export function getModelsByProvider(provider: AIProviderType): ModelConfig[] {
  return Object.values(MODEL_CONFIGS).filter((m) => m.provider === provider);
}

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_CONFIGS[modelId];
}
