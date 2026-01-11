/**
 * Settings Tab
 * Plugin settings tab UI
 */

import { App, PluginSettingTab, Setting, Notice, DropdownComponent } from 'obsidian';
import type LearningPathGeneratorPlugin from '../main';
import {
  AIProviderType,
  AI_PROVIDERS,
  getModelsByProvider,
} from '../core/domain';

export class LearningPathSettingTab extends PluginSettingTab {
  plugin: LearningPathGeneratorPlugin;
  private modelDropdown: DropdownComponent | null = null;

  constructor(app: App, plugin: LearningPathGeneratorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Learning Path Generator Settings' });

    // AI Settings Section
    this.displayAISettings(containerEl);

    // Embedding Settings Section (async - must await)
    await this.displayEmbeddingSettings(containerEl);

    // Storage Settings
    containerEl.createEl('h3', { text: 'Storage Settings' });

    new Setting(containerEl)
      .setName('Data Storage Folder')
      .setDesc('Folder path to store learning path data')
      .addText((text) =>
        text
          .setPlaceholder('.learning-paths')
          .setValue(this.plugin.settings.storagePath)
          .onChange(async (value) => {
            this.plugin.settings.storagePath = value || '.learning-paths';
            await this.plugin.saveSettings();
          })
      );

    // Frontmatter Settings
    containerEl.createEl('h3', { text: 'Frontmatter Settings' });

    new Setting(containerEl)
      .setName('Mastery Level Key')
      .setDesc('Frontmatter key to store mastery level')
      .addText((text) =>
        text
          .setPlaceholder('learning_mastery')
          .setValue(this.plugin.settings.masteryLevelKey)
          .onChange(async (value) => {
            this.plugin.settings.masteryLevelKey = value || 'learning_mastery';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Last Studied Key')
      .setDesc('Frontmatter key to store last studied time')
      .addText((text) =>
        text
          .setPlaceholder('learning_last_studied')
          .setValue(this.plugin.settings.lastStudiedKey)
          .onChange(async (value) => {
            this.plugin.settings.lastStudiedKey = value || 'learning_last_studied';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Study Count Key')
      .setDesc('Frontmatter key to store study count')
      .addText((text) =>
        text
          .setPlaceholder('learning_study_count')
          .setValue(this.plugin.settings.studyCountKey)
          .onChange(async (value) => {
            this.plugin.settings.studyCountKey = value || 'learning_study_count';
            await this.plugin.saveSettings();
          })
      );

    // General Settings
    containerEl.createEl('h3', { text: 'General Settings' });

    new Setting(containerEl)
      .setName('Excluded Folders')
      .setDesc('Folders to exclude from learning path generation (comma-separated)')
      .addText((text) =>
        text
          .setPlaceholder('Templates, Archive')
          .setValue(this.plugin.settings.excludeFolders.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = value
              .split(',')
              .map((f) => f.trim())
              .filter((f) => f.length > 0);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Default Estimated Time')
      .setDesc('Default estimated study time per node (minutes)')
      .addSlider((slider) =>
        slider
          .setLimits(5, 60, 5)
          .setValue(this.plugin.settings.defaultEstimatedMinutes)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.defaultEstimatedMinutes = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Auto Open Sidebar View')
      .setDesc('Automatically open learning path view when plugin loads')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoOpenView)
          .onChange(async (value) => {
            this.plugin.settings.autoOpenView = value;
            await this.plugin.saveSettings();
          })
      );

    // Display Settings
    containerEl.createEl('h3', { text: 'Display Settings' });

    new Setting(containerEl)
      .setName('Max Display Nodes')
      .setDesc('Maximum number of nodes to display in learning path (analysis covers all notes)')
      .addSlider((slider) =>
        slider
          .setLimits(10, 100, 10)
          .setValue(this.plugin.settings.maxDisplayNodes)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxDisplayNodes = value;
            await this.plugin.saveSettings();
          })
      );

    // About Section
    containerEl.createEl('h3', { text: 'About' });

    const aboutEl = containerEl.createDiv({ cls: 'setting-item' });
    aboutEl.createEl('p', {
      text: `Learning Path Generator v${this.plugin.manifest.version}`,
      cls: 'setting-item-description',
    });
    aboutEl.createEl('p', {
      text: 'Generate learning paths and curricula from your vault notes.',
      cls: 'setting-item-description',
    });
    aboutEl.createEl('p', {
      text: 'Semantic search uses embedding data from the Vault Embeddings plugin.',
      cls: 'setting-item-description',
    });
  }

  private displayAISettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'AI Settings' });

    const currentProvider = this.plugin.settings.ai.provider;
    const currentProviderConfig = AI_PROVIDERS[currentProvider as keyof typeof AI_PROVIDERS];

    // Enable AI toggle
    new Setting(containerEl)
      .setName('Enable AI Analysis')
      .setDesc('Use AI to analyze learning paths. If disabled, only link-based analysis is performed.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.ai.enabled)
          .onChange(async (value) => {
            this.plugin.settings.ai.enabled = value;
            await this.plugin.saveSettings();
          })
      );

    // Provider selection
    new Setting(containerEl)
      .setName('AI Provider')
      .setDesc('Select the AI service to use')
      .addDropdown((dropdown) => {
        Object.entries(AI_PROVIDERS).forEach(([key, config]) => {
          dropdown.addOption(key, config.displayName);
        });
        dropdown.setValue(currentProvider);
        dropdown.onChange(async (value) => {
          this.plugin.settings.ai.provider = value as AIProviderType;
          await this.plugin.saveSettings();
          this.display(); // Refresh to update model dropdown
        });
      });

    // API Key input with Test button
    new Setting(containerEl)
      .setName(`${currentProviderConfig.displayName} API Key`)
      .setDesc(this.getApiKeyDescription(currentProvider))
      .addText((text) => {
        text
          .setPlaceholder('Enter API key')
          .setValue(this.plugin.settings.ai.apiKeys[currentProvider] ?? '')
          .onChange(async (value) => {
            this.plugin.settings.ai.apiKeys[currentProvider] = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
        text.inputEl.style.width = '300px';
      })
      .addButton((button) => {
        button
          .setButtonText('Test')
          .onClick(async () => {
            const apiKey = this.plugin.settings.ai.apiKeys[currentProvider];

            if (!apiKey) {
              new Notice('Please enter an API key first.');
              return;
            }

            button.setDisabled(true);
            button.setButtonText('Testing...');

            try {
              const isValid = await this.plugin.testApiKey(currentProvider, apiKey);
              if (isValid) {
                new Notice(`${currentProviderConfig.displayName} API key is valid!`);
              } else {
                new Notice(`${currentProviderConfig.displayName} API key is invalid.`);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unknown error';
              new Notice(`Test failed: ${message}`);
            } finally {
              button.setDisabled(false);
              button.setButtonText('Test');
            }
          });
      });

    // Model selection
    new Setting(containerEl)
      .setName('Model')
      .setDesc('Select the model to use')
      .addDropdown((dropdown) => {
        this.modelDropdown = dropdown;
        this.populateModelDropdown(dropdown, currentProvider);
        dropdown.setValue(
          this.plugin.settings.ai.models[currentProvider] ??
            currentProviderConfig.defaultModel
        );
        dropdown.onChange(async (value) => {
          this.plugin.settings.ai.models[currentProvider] = value;
          await this.plugin.saveSettings();
        });
      });
  }

  private populateModelDropdown(dropdown: DropdownComponent, provider: AIProviderType): void {
    const models = getModelsByProvider(provider);
    models.forEach((model) => {
      dropdown.addOption(model.id, model.displayName);
    });
  }

  private getApiKeyDescription(provider: AIProviderType): string {
    switch (provider) {
      case 'claude':
        return 'Get your API key from https://console.anthropic.com';
      case 'openai':
        return 'Get your API key from https://platform.openai.com';
      case 'gemini':
        return 'Get your API key from https://aistudio.google.com';
      case 'grok':
        return 'Get your API key from https://console.x.ai';
      default:
        return 'Enter your API key.';
    }
  }

  private async displayEmbeddingSettings(containerEl: HTMLElement): Promise<void> {
    containerEl.createEl('h3', { text: 'Semantic Search Settings' });

    // Vault Embeddings integration info
    const infoEl = containerEl.createDiv({ cls: 'setting-item-description' });
    infoEl.style.marginBottom = '15px';
    infoEl.style.padding = '10px';
    infoEl.style.backgroundColor = 'var(--background-secondary)';
    infoEl.style.borderRadius = '5px';
    infoEl.innerHTML = `
      <p style="margin: 0 0 5px 0;"><strong>Vault Embeddings Integration</strong></p>
      <p style="margin: 0; font-size: 0.9em;">Note embeddings are managed by the <strong>Vault Embeddings</strong> plugin.<br>
      This plugin reads stored embeddings to perform semantic search.</p>
    `;

    // Embedding status display
    const stats = await this.plugin.getEmbeddingStats();
    const statsEl = containerEl.createDiv({ cls: 'embedding-stats' });
    statsEl.style.padding = '10px';
    statsEl.style.backgroundColor = 'var(--background-secondary)';
    statsEl.style.borderRadius = '5px';
    statsEl.style.marginBottom = '15px';

    if (!stats.isAvailable) {
      statsEl.createEl('p', {
        text: 'Vault Embeddings data not found.',
        cls: 'mod-warning',
      });
      statsEl.createEl('p', {
        text: 'Install Vault Embeddings plugin and run "Embed All Notes".',
        cls: 'setting-item-description',
      });
    } else {
      statsEl.createEl('p', {
        text: `Embeddings loaded: ${stats.totalEmbeddings}`,
      });
      statsEl.createEl('p', {
        text: `Model: ${stats.model} (${stats.provider})`,
        cls: 'setting-item-description',
      });
    }

    // OpenAI API Key for query embeddings
    new Setting(containerEl)
      .setName('OpenAI API Key for Query Embeddings')
      .setDesc('OpenAI API key for embedding search queries. Leave empty to use the OpenAI key from AI settings.')
      .addText((text) => {
        text
          .setPlaceholder('sk-...')
          .setValue(this.plugin.settings.embedding.openaiApiKey ?? '')
          .onChange(async (value) => {
            this.plugin.settings.embedding.openaiApiKey = value || undefined;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
        text.inputEl.style.width = '300px';
      });

    // Refresh embeddings button
    new Setting(containerEl)
      .setName('Refresh Embeddings Cache')
      .setDesc('Reload latest embedding data from Vault Embeddings.')
      .addButton((button) =>
        button
          .setButtonText('Refresh')
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText('Loading...');
            try {
              // Use command to refresh
              await (this.plugin as any).refreshEmbeddings();
              await this.display(); // Refresh UI
            } catch (error) {
              new Notice('Refresh failed');
            } finally {
              button.setDisabled(false);
              button.setButtonText('Refresh');
            }
          })
      );

    // Note about embedding workflow
    const noteEl = containerEl.createDiv({ cls: 'setting-item-description' });
    noteEl.style.marginTop = '10px';
    noteEl.style.fontStyle = 'italic';
    noteEl.innerHTML = 'Note: Create and manage note embeddings in Vault Embeddings plugin settings.';
  }
}
