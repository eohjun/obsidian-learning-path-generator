/**
 * Settings Tab
 * 플러그인 설정 탭 UI
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

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: '학습 경로 생성기 설정' });

    // AI Settings Section
    this.displayAISettings(containerEl);

    // Embedding Settings Section
    this.displayEmbeddingSettings(containerEl);

    // Storage Settings
    containerEl.createEl('h3', { text: '저장소 설정' });

    new Setting(containerEl)
      .setName('데이터 저장 폴더')
      .setDesc('학습 경로 데이터를 저장할 폴더 경로')
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
    containerEl.createEl('h3', { text: 'Frontmatter 설정' });

    new Setting(containerEl)
      .setName('숙달 레벨 키')
      .setDesc('노트의 frontmatter에서 숙달 레벨을 저장할 키')
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
      .setName('마지막 학습 시간 키')
      .setDesc('마지막 학습 시간을 저장할 frontmatter 키')
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
      .setName('학습 횟수 키')
      .setDesc('학습 횟수를 저장할 frontmatter 키')
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
    containerEl.createEl('h3', { text: '일반 설정' });

    new Setting(containerEl)
      .setName('제외할 폴더')
      .setDesc('학습 경로 생성에서 제외할 폴더들 (쉼표로 구분)')
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
      .setName('기본 예상 학습 시간')
      .setDesc('노드당 기본 예상 학습 시간 (분)')
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
      .setName('사이드바 뷰 자동 열기')
      .setDesc('플러그인 로드 시 학습 경로 뷰를 자동으로 엽니다')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoOpenView)
          .onChange(async (value) => {
            this.plugin.settings.autoOpenView = value;
            await this.plugin.saveSettings();
          })
      );

    // Display Settings
    containerEl.createEl('h3', { text: '표시 설정' });

    new Setting(containerEl)
      .setName('최대 표시 노드 수')
      .setDesc('학습 경로에서 표시할 최대 노드 수 (분석은 전체 노트를 대상으로 수행)')
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
    containerEl.createEl('h3', { text: '정보' });

    const aboutEl = containerEl.createDiv({ cls: 'setting-item' });
    aboutEl.createEl('p', {
      text: 'Learning Path Generator v0.3.0',
      cls: 'setting-item-description',
    });
    aboutEl.createEl('p', {
      text: '볼트의 노트들로부터 학습 경로와 커리큘럼을 생성합니다.',
      cls: 'setting-item-description',
    });
  }

  private displayAISettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'AI 설정' });

    const currentProvider = this.plugin.settings.ai.provider;
    const currentProviderConfig = AI_PROVIDERS[currentProvider as keyof typeof AI_PROVIDERS];

    // Enable AI toggle
    new Setting(containerEl)
      .setName('AI 분석 사용')
      .setDesc('AI를 사용하여 학습 경로를 분석합니다. 비활성화하면 링크 기반 분석만 수행합니다.')
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
      .setName('AI 프로바이더')
      .setDesc('사용할 AI 서비스를 선택하세요')
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
      .setName(`${currentProviderConfig.displayName} API 키`)
      .setDesc(this.getApiKeyDescription(currentProvider))
      .addText((text) => {
        text
          .setPlaceholder('API 키 입력')
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
          .setButtonText('테스트')
          .onClick(async () => {
            const apiKey = this.plugin.settings.ai.apiKeys[currentProvider];

            if (!apiKey) {
              new Notice('API 키를 먼저 입력해주세요.');
              return;
            }

            button.setDisabled(true);
            button.setButtonText('테스트 중...');

            try {
              const isValid = await this.plugin.testApiKey(currentProvider, apiKey);
              if (isValid) {
                new Notice(`✅ ${currentProviderConfig.displayName} API 키가 유효합니다!`);
              } else {
                new Notice(`❌ ${currentProviderConfig.displayName} API 키가 유효하지 않습니다.`);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : '알 수 없는 오류';
              new Notice(`❌ 테스트 실패: ${message}`);
            } finally {
              button.setDisabled(false);
              button.setButtonText('테스트');
            }
          });
      });

    // Model selection
    new Setting(containerEl)
      .setName('모델')
      .setDesc('사용할 모델을 선택하세요')
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
        return 'https://console.anthropic.com 에서 발급받을 수 있습니다.';
      case 'openai':
        return 'https://platform.openai.com 에서 발급받을 수 있습니다.';
      case 'gemini':
        return 'https://aistudio.google.com 에서 발급받을 수 있습니다.';
      case 'grok':
        return 'https://console.x.ai 에서 발급받을 수 있습니다.';
      default:
        return 'API 키를 입력하세요.';
    }
  }

  private displayEmbeddingSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: '임베딩 설정 (의미 검색)' });

    // Embedding stats display
    const statsContainer = containerEl.createDiv({ cls: 'embedding-stats-container' });
    this.updateEmbeddingStats(statsContainer);

    // Auto-embed toggle
    new Setting(containerEl)
      .setName('자동 임베딩')
      .setDesc('노트 생성/수정 시 자동으로 임베딩을 업데이트합니다.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.embedding.autoEmbed)
          .onChange(async (value) => {
            this.plugin.settings.embedding.autoEmbed = value;
            await this.plugin.saveSettings();
            new Notice(value ? '자동 임베딩 활성화 (재시작 필요)' : '자동 임베딩 비활성화');
          })
      );

    // Index on startup toggle
    new Setting(containerEl)
      .setName('시작 시 인덱싱')
      .setDesc('플러그인 시작 시 임베딩되지 않은 노트들을 자동으로 인덱싱합니다.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.embedding.indexOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.embedding.indexOnStartup = value;
            await this.plugin.saveSettings();
          })
      );

    // Re-index button
    new Setting(containerEl)
      .setName('전체 리인덱싱')
      .setDesc('모든 노트의 임베딩을 다시 생성합니다. 시간이 걸릴 수 있습니다.')
      .addButton((button) =>
        button
          .setButtonText('리인덱싱 시작')
          .setWarning()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText('인덱싱 중...');

            try {
              const count = await this.plugin.reindexAllNotes();
              this.updateEmbeddingStats(statsContainer);
              new Notice(`리인덱싱 완료: ${count}개 노트`);
            } catch (error) {
              const message = error instanceof Error ? error.message : '알 수 없는 오류';
              new Notice(`리인덱싱 실패: ${message}`);
            } finally {
              button.setDisabled(false);
              button.setButtonText('리인덱싱 시작');
            }
          })
      );

    // Note about OpenAI API key
    const noteEl = containerEl.createDiv({ cls: 'setting-item-description' });
    noteEl.style.marginTop = '10px';
    noteEl.style.fontStyle = 'italic';
    noteEl.innerHTML = '※ 임베딩은 OpenAI API (text-embedding-3-small)를 사용합니다. AI 설정에서 OpenAI API 키를 설정해주세요.';
  }

  private async updateEmbeddingStats(container: HTMLElement): Promise<void> {
    container.empty();

    const stats = await this.plugin.getEmbeddingStats();

    const statsEl = container.createDiv({ cls: 'embedding-stats' });
    statsEl.style.padding = '10px';
    statsEl.style.backgroundColor = 'var(--background-secondary)';
    statsEl.style.borderRadius = '5px';
    statsEl.style.marginBottom = '10px';

    if (!stats.isAvailable) {
      statsEl.createEl('p', {
        text: '⚠️ OpenAI API 키가 설정되지 않아 임베딩을 사용할 수 없습니다.',
        cls: 'mod-warning',
      });
      return;
    }

    const percentage = stats.totalNotes > 0
      ? Math.round((stats.embeddedNotes / stats.totalNotes) * 100)
      : 0;

    statsEl.createEl('p', {
      text: `📊 임베딩 상태: ${stats.embeddedNotes} / ${stats.totalNotes} 노트 (${percentage}%)`,
    });

    // Progress bar
    const progressContainer = statsEl.createDiv({ cls: 'embedding-progress-bar' });
    progressContainer.style.width = '100%';
    progressContainer.style.height = '8px';
    progressContainer.style.backgroundColor = 'var(--background-modifier-border)';
    progressContainer.style.borderRadius = '4px';
    progressContainer.style.overflow = 'hidden';
    progressContainer.style.marginTop = '5px';

    const progressFill = progressContainer.createDiv();
    progressFill.style.width = `${percentage}%`;
    progressFill.style.height = '100%';
    progressFill.style.backgroundColor = percentage === 100
      ? 'var(--interactive-success)'
      : 'var(--interactive-accent)';
    progressFill.style.transition = 'width 0.3s ease';
  }
}
