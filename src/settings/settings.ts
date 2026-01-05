/**
 * Plugin Settings
 * 학습 경로 생성기 플러그인 설정
 */

export interface LearningPathSettings {
  /**
   * Claude API 키
   */
  claudeApiKey: string;

  /**
   * Claude 모델
   */
  claudeModel: string;

  /**
   * LLM 분석 사용 여부
   */
  useLLMAnalysis: boolean;

  /**
   * 학습 경로 데이터 저장 폴더
   */
  storagePath: string;

  /**
   * Frontmatter 숙달 레벨 키
   */
  masteryLevelKey: string;

  /**
   * Frontmatter 마지막 학습 시간 키
   */
  lastStudiedKey: string;

  /**
   * Frontmatter 학습 횟수 키
   */
  studyCountKey: string;

  /**
   * 제외할 폴더들
   */
  excludeFolders: string[];

  /**
   * 노드당 기본 예상 학습 시간 (분)
   */
  defaultEstimatedMinutes: number;

  /**
   * 사이드바 뷰 자동 열기
   */
  autoOpenView: boolean;
}

export const DEFAULT_SETTINGS: LearningPathSettings = {
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-4-20250514',
  useLLMAnalysis: true,
  storagePath: '.learning-paths',
  masteryLevelKey: 'learning_mastery',
  lastStudiedKey: 'learning_last_studied',
  studyCountKey: 'learning_study_count',
  excludeFolders: ['Templates', 'Archive', '.obsidian'],
  defaultEstimatedMinutes: 15,
  autoOpenView: false,
};
