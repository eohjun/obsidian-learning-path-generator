/**
 * Plugin Settings
 * Learning Path Generator plugin settings
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

  // Embedding Settings (for query embeddings)
  // Note embeddings are managed by Vault Embeddings plugin
  embedding: {
    /** OpenAI API key for query embeddings (uses OpenAI key from AI settings if not set) */
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
    // API key for query embeddings (OpenAI)
    // Uses OpenAI key from AI settings if available
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
