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

  // Embedding Settings (Semantic Search)
  embedding: {
    /** 자동 임베딩 활성화 (노트 생성/수정 시 자동 업데이트) */
    autoEmbed: boolean;
    /** 플러그인 시작 시 전체 인덱싱 */
    indexOnStartup: boolean;
    /** 임베딩 제외 폴더 (기본: excludeFolders 사용) */
    excludeFolders?: string[];
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
    autoEmbed: true,
    indexOnStartup: true,
    excludeFolders: undefined, // Use general excludeFolders by default
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
