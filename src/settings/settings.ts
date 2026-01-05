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
  storagePath: '_learning-paths',
  masteryLevelKey: 'learning_mastery',
  lastStudiedKey: 'learning_last_studied',
  studyCountKey: 'learning_study_count',
  excludeFolders: ['Templates', 'Archive', '.obsidian'],
  defaultEstimatedMinutes: 15,
  autoOpenView: false,
  maxDisplayNodes: 50,
};
