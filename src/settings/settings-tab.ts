/**
 * Settings Tab
 * 플러그인 설정 탭 UI
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import type LearningPathGeneratorPlugin from '../main';
import { LearningPathSettings } from './settings';

export class LearningPathSettingTab extends PluginSettingTab {
  plugin: LearningPathGeneratorPlugin;

  constructor(app: App, plugin: LearningPathGeneratorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: '학습 경로 생성기 설정' });

    // LLM Settings
    containerEl.createEl('h3', { text: 'AI 설정 (Claude)' });

    new Setting(containerEl)
      .setName('Claude API 키')
      .setDesc('Anthropic Claude API 키를 입력하세요. https://console.anthropic.com 에서 발급받을 수 있습니다.')
      .addText((text) =>
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.claudeApiKey)
          .onChange(async (value) => {
            this.plugin.settings.claudeApiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Claude 모델')
      .setDesc('사용할 Claude 모델을 선택하세요')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('claude-sonnet-4-20250514', 'Claude Sonnet 4 (추천)')
          .addOption('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet')
          .addOption('claude-3-haiku-20240307', 'Claude 3 Haiku (빠름)')
          .setValue(this.plugin.settings.claudeModel)
          .onChange(async (value) => {
            this.plugin.settings.claudeModel = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('AI 분석 사용')
      .setDesc('AI를 사용하여 학습 경로를 분석합니다. 비활성화하면 링크 기반 분석만 수행합니다.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useLLMAnalysis)
          .onChange(async (value) => {
            this.plugin.settings.useLLMAnalysis = value;
            await this.plugin.saveSettings();
          })
      );

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

    // About Section
    containerEl.createEl('h3', { text: '정보' });

    const aboutEl = containerEl.createDiv({ cls: 'setting-item' });
    aboutEl.createEl('p', {
      text: 'Learning Path Generator v0.2.0',
      cls: 'setting-item-description',
    });
    aboutEl.createEl('p', {
      text: '볼트의 노트들로부터 학습 경로와 커리큘럼을 생성합니다.',
      cls: 'setting-item-description',
    });
  }
}
