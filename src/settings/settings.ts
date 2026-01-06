/**
 * Plugin Settings
 * 학습 경로 생성기 플러그인 설정
 */

import { AIProviderType } from '../core/domain';

export interface LearningPathSettings {
  // AI Settings
  ai: {
    provider: AIProviderType;
    apiKeys: Partial<Record<AIProviderType, string>>;
    models: Partial<Record<AIProviderType, string>>;
    enabled: boolean;
  };

  // Embedding Settings (쿼리 임베딩용)
  // 노트 임베딩은 Vault Embeddings 플러그인이 담당
  embedding: {
    /** 쿼리 임베딩용 OpenAI API 키 (설정되지 않으면 AI 설정의 OpenAI 키 사용) */
    openaiApiKey?: string;
  };

  // Storage Settings
  storagePath: string;

  // Frontmatter Settings
  masteryLevelKey: string;
  lastStudiedKey: string;
  studyCountKey: string;

  // General Settings
  excludeFolders: string[];
  defaultEstimatedMinutes: number;
  autoOpenView: boolean;

  // Display Settings
  maxDisplayNodes: number;
}

export const DEFAULT_SETTINGS: LearningPathSettings = {
  ai: {
    provider: 'claude',
    apiKeys: {},
    models: {},
    enabled: true,
  },
  embedding: {
    // 쿼리 임베딩용 API 키 (OpenAI)
    // AI 설정의 OpenAI 키가 있으면 그것을 사용
  },
  storagePath: '_learning-paths',
  masteryLevelKey: 'learning_mastery',
  lastStudiedKey: 'learning_last_studied',
  studyCountKey: 'learning_study_count',
  excludeFolders: ['Templates', 'Archive', '.obsidian'],
  defaultEstimatedMinutes: 15,
  autoOpenView: false,
  maxDisplayNodes: 50,
};
