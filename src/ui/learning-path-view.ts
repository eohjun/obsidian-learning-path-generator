/**
 * LearningPathView
 * 학습 경로를 표시하는 사이드바 뷰
 */

import { ItemView, WorkspaceLeaf, setIcon, Notice } from 'obsidian';
import {
  LearningPath,
  LearningNode,
  MasteryLevel,
  MasteryLevelValue,
  PathStatistics,
  IPathRepository,
  KnowledgeGapItem,
} from '../core/domain';
import {
  GenerateLearningPathUseCase,
  UpdateProgressUseCase,
  GeneratePathRequest,
  UpdateProgressRequest,
} from '../core/application';

export const VIEW_TYPE_LEARNING_PATH = 'learning-path-view';

export interface LearningPathViewDependencies {
  generatePathUseCase: GenerateLearningPathUseCase;
  updateProgressUseCase: UpdateProgressUseCase;
  pathRepository: IPathRepository;
  getMaxDisplayNodes: () => number;
  isPKMAvailable?: () => boolean;
}

export class LearningPathView extends ItemView {
  private currentPath: LearningPath | null = null;
  private dependencies: LearningPathViewDependencies | null = null;
  private pkmStatusEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  setDependencies(deps: LearningPathViewDependencies): void {
    this.dependencies = deps;
  }

  /**
   * PKM 연동 상태 업데이트 (main.ts에서 호출)
   */
  updatePKMStatus(available: boolean): void {
    if (this.pkmStatusEl) {
      this.pkmStatusEl.setText(available ? '의미 검색' : '링크 기반');
      this.pkmStatusEl.toggleClass('pkm-active', available);
      this.pkmStatusEl.toggleClass('pkm-inactive', !available);
      this.pkmStatusEl.setAttribute(
        'aria-label',
        available
          ? 'PKM Note Recommender 연동됨 - AI 기반 의미 검색 사용'
          : 'PKM Note Recommender 없음 - 노트 링크 기반 분석 사용'
      );
    }
  }

  getViewType(): string {
    return VIEW_TYPE_LEARNING_PATH;
  }

  getDisplayText(): string {
    return '학습 경로';
  }

  getIcon(): string {
    return 'route';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('learning-path-view');

    this.renderEmptyState(container);
  }

  async onClose(): Promise<void> {
    // Cleanup
  }

  /**
   * 학습 경로 표시
   */
  async displayPath(path: LearningPath): Promise<void> {
    this.currentPath = path;
    await this.refresh();
  }

  /**
   * 뷰 새로고침
   */
  async refresh(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('learning-path-view');

    if (!this.currentPath) {
      this.renderEmptyState(container);
      return;
    }

    this.renderPath(container, this.currentPath);
  }

  /**
   * 빈 상태 렌더링
   */
  private renderEmptyState(container: Element): void {
    // PKM 상태 표시 바
    this.renderStatusBar(container);

    const emptyEl = container.createDiv({ cls: 'learning-path-empty' });

    const iconEl = emptyEl.createDiv({ cls: 'learning-path-empty-icon' });
    setIcon(iconEl, 'route');

    emptyEl.createEl('h3', { text: '학습 경로가 없습니다' });
    emptyEl.createEl('p', {
      text: '노트를 선택하고 학습 경로를 생성하세요.',
    });

    const createBtn = emptyEl.createEl('button', {
      cls: 'mod-cta',
      text: '새 학습 경로 생성',
    });
    createBtn.addEventListener('click', () => this.showCreateDialog());
  }

  /**
   * PKM 상태 표시 바 렌더링
   */
  private renderStatusBar(container: Element): void {
    const statusBar = container.createDiv({ cls: 'learning-path-status-bar' });

    // 알고리즘 상태 표시
    const statusLabel = statusBar.createSpan({ cls: 'learning-path-status-label' });
    statusLabel.setText('분석 모드:');

    this.pkmStatusEl = statusBar.createSpan({ cls: 'learning-path-status-indicator' });

    const isPKMAvailable = this.dependencies?.isPKMAvailable?.() ?? false;
    this.updatePKMStatus(isPKMAvailable);
  }

  /**
   * 학습 경로 렌더링
   */
  private renderPath(container: Element, path: LearningPath): void {
    // PKM 상태 표시 바
    this.renderStatusBar(container);

    // Header
    const header = container.createDiv({ cls: 'learning-path-header' });
    this.renderHeader(header, path);

    // Statistics
    const statsEl = container.createDiv({ cls: 'learning-path-stats' });
    this.renderStatistics(statsEl, path.getStatistics());

    // Progress Bar
    const progressEl = container.createDiv({ cls: 'learning-path-progress' });
    this.renderProgressBar(progressEl, path.getStatistics());

    // Knowledge Gaps (always show section)
    const gapsEl = container.createDiv({ cls: 'learning-path-gaps' });
    this.renderKnowledgeGaps(gapsEl, (path.knowledgeGaps ?? []) as KnowledgeGapItem[], path.totalAnalyzedNotes);

    // Node List
    const nodesEl = container.createDiv({ cls: 'learning-path-nodes' });
    this.renderNodes(nodesEl, path);

    // Actions
    const actionsEl = container.createDiv({ cls: 'learning-path-actions' });
    this.renderActions(actionsEl, path);
  }

  /**
   * 헤더 렌더링
   */
  private renderHeader(container: Element, path: LearningPath): void {
    const titleEl = container.createDiv({ cls: 'learning-path-title' });

    const iconEl = titleEl.createSpan({ cls: 'learning-path-title-icon' });
    setIcon(iconEl, 'target');

    titleEl.createSpan({ text: path.goalNoteTitle });

    const actionsEl = container.createDiv({ cls: 'learning-path-header-actions' });

    // New path button
    const newPathBtn = actionsEl.createEl('button', {
      cls: 'learning-path-menu-btn clickable-icon',
      attr: { 'aria-label': '새 학습 경로 생성' },
    });
    setIcon(newPathBtn, 'plus');
    newPathBtn.addEventListener('click', () => this.showCreateDialog());

    // Delete path button
    const deleteBtn = actionsEl.createEl('button', {
      cls: 'learning-path-menu-btn clickable-icon',
      attr: { 'aria-label': '경로 삭제' },
    });
    setIcon(deleteBtn, 'trash-2');
    deleteBtn.addEventListener('click', () => this.deletePath(path));

    // Close button (hide without deleting)
    const closeBtn = actionsEl.createEl('button', {
      cls: 'learning-path-menu-btn clickable-icon',
      attr: { 'aria-label': '닫기 (삭제하지 않음)' },
    });
    setIcon(closeBtn, 'x');
    closeBtn.addEventListener('click', () => this.closePath());
  }

  /**
   * 경로 닫기 (삭제하지 않고 뷰만 비움)
   */
  private async closePath(): Promise<void> {
    this.currentPath = null;
    await this.refresh();
  }

  /**
   * 현재 경로 비우기 (외부에서 호출 가능)
   * main.ts에서 다른 노트의 경로를 로드하기 전에 호출
   */
  async clearCurrentPath(): Promise<void> {
    this.currentPath = null;
    await this.refresh();
  }

  /**
   * 로딩 상태 표시 (외부에서 호출 가능)
   */
  async showLoadingState(goalNoteId: string): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('learning-path-view');
    this.renderLoadingState(container, goalNoteId);
  }

  /**
   * 오류 상태 표시 (외부에서 호출 가능)
   */
  async showErrorState(message: string): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('learning-path-view');
    this.renderErrorState(container, message);
  }

  /**
   * 경로 삭제 (실제 JSON 파일 삭제)
   */
  private async deletePath(path: LearningPath): Promise<void> {
    if (!this.dependencies) {
      new Notice('오류: Dependencies not set');
      return;
    }

    try {
      // Delete from repository (actual file deletion)
      await this.dependencies.pathRepository.delete(path.id);

      // Clear current path and show empty state
      this.currentPath = null;
      await this.refresh();
      new Notice('학습 경로가 삭제되었습니다');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      new Notice(`삭제 실패: ${errorMsg}`);
      console.error('[LearningPathView] Delete failed:', error);
    }
  }

  /**
   * 통계 렌더링
   */
  private renderStatistics(container: Element, stats: PathStatistics): void {
    const items = [
      {
        label: '완료',
        value: stats.completedNodes.toString(),
        icon: 'check-circle',
      },
      {
        label: '진행 중',
        value: stats.inProgressNodes.toString(),
        icon: 'clock',
      },
      {
        label: '남은 노드',
        value: stats.remainingNodes().toString(),
        icon: 'circle',
      },
      {
        label: '예상 시간',
        value: `${stats.estimatedHours()}h`,
        icon: 'timer',
      },
    ];

    for (const item of items) {
      const statEl = container.createDiv({ cls: 'learning-path-stat-item' });

      const iconEl = statEl.createSpan({ cls: 'learning-path-stat-icon' });
      setIcon(iconEl, item.icon);

      statEl.createSpan({
        cls: 'learning-path-stat-value',
        text: item.value,
      });
      statEl.createSpan({
        cls: 'learning-path-stat-label',
        text: item.label,
      });
    }
  }

  /**
   * 진행률 바 렌더링
   */
  private renderProgressBar(container: Element, stats: PathStatistics): void {
    const percent = stats.progressPercent();

    const labelEl = container.createDiv({ cls: 'learning-path-progress-label' });
    labelEl.createSpan({ text: '진행률' });
    labelEl.createSpan({ text: `${percent}%` });

    const barContainer = container.createDiv({
      cls: 'learning-path-progress-bar',
    });
    const barFill = barContainer.createDiv({
      cls: 'learning-path-progress-fill',
    });
    barFill.style.width = `${percent}%`;

    if (percent === 100) {
      barFill.addClass('complete');
    }
  }

  /**
   * 지식 갭 섹션 렌더링
   */
  private renderKnowledgeGaps(
    container: Element,
    gaps: KnowledgeGapItem[],
    totalAnalyzedNotes: number
  ): void {
    // Header
    const headerEl = container.createDiv({ cls: 'learning-path-gaps-header' });
    const titleEl = headerEl.createDiv({ cls: 'learning-path-gaps-title' });

    const iconEl = titleEl.createSpan({ cls: 'learning-path-gaps-icon' });
    setIcon(iconEl, gaps.length > 0 ? 'alert-triangle' : 'check-circle');
    titleEl.createSpan({ text: gaps.length > 0 ? '지식 갭 발견' : '지식 갭 분석' });

    // Stats
    const statsEl = headerEl.createDiv({ cls: 'learning-path-gaps-stats' });
    if (totalAnalyzedNotes > 0) {
      statsEl.createSpan({
        text: gaps.length > 0
          ? `${totalAnalyzedNotes}개 노트 분석 → ${gaps.length}개 갭 발견`
          : `${totalAnalyzedNotes}개 노트 분석 완료`,
        cls: 'learning-path-gaps-count'
      });
    }

    // Empty state
    if (gaps.length === 0) {
      const emptyEl = container.createDiv({ cls: 'learning-path-gaps-empty' });
      emptyEl.createEl('p', {
        text: totalAnalyzedNotes > 0
          ? '✅ 발견된 지식 갭이 없습니다. 현재 볼트의 노트들로 충분히 학습할 수 있습니다.'
          : '⚠️ 지식 갭 분석이 수행되지 않았습니다. AI 분석이 활성화되어 있는지 확인하세요.',
        cls: 'learning-path-gaps-empty-text'
      });
      return;
    }

    // Gap List
    const listEl = container.createDiv({ cls: 'learning-path-gaps-list' });

    // Sort by priority (high first)
    const sortedGaps = [...gaps].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    for (const gap of sortedGaps) {
      const gapEl = listEl.createDiv({
        cls: `learning-path-gap-item priority-${gap.priority}`
      });

      // Priority badge
      const badgeEl = gapEl.createSpan({ cls: 'learning-path-gap-badge' });
      const priorityText = gap.priority === 'high' ? '필수' : gap.priority === 'medium' ? '권장' : '선택';
      badgeEl.setText(priorityText);

      // Content
      const contentEl = gapEl.createDiv({ cls: 'learning-path-gap-content' });

      // Concept name
      contentEl.createEl('strong', {
        text: gap.concept,
        cls: 'learning-path-gap-concept'
      });

      // Reason
      if (gap.reason) {
        contentEl.createEl('p', {
          text: gap.reason,
          cls: 'learning-path-gap-reason'
        });
      }

      // Resources
      if (gap.suggestedResources && gap.suggestedResources.length > 0) {
        const resourcesEl = contentEl.createDiv({ cls: 'learning-path-gap-resources' });
        resourcesEl.createSpan({ text: '학습 자료: ', cls: 'learning-path-gap-resources-label' });
        resourcesEl.createSpan({
          text: gap.suggestedResources.join(', '),
          cls: 'learning-path-gap-resources-list'
        });
      }

      // Action button - search in vault
      const actionEl = gapEl.createDiv({ cls: 'learning-path-gap-action' });
      const searchBtn = actionEl.createEl('button', {
        cls: 'learning-path-gap-search-btn clickable-icon',
        attr: { 'aria-label': `"${gap.concept}" 검색` }
      });
      setIcon(searchBtn, 'search');
      searchBtn.addEventListener('click', () => {
        // Open search with the concept as query
        (this.app as any).internalPlugins?.plugins?.['global-search']?.instance?.openGlobalSearch(gap.concept);
      });
    }

    // Help text
    const helpEl = container.createDiv({ cls: 'learning-path-gaps-help' });
    helpEl.createEl('p', {
      text: '💡 이 주제들에 대한 노트를 추가하면 학습이 더 완전해집니다.',
      cls: 'learning-path-gaps-help-text'
    });
  }

  /**
   * 노드 목록 렌더링
   */
  private renderNodes(container: Element, path: LearningPath): void {
    const allNodes = path.nodes;
    const maxDisplay = this.dependencies?.getMaxDisplayNodes() ?? 50;
    const displayNodes = allNodes.slice(0, maxDisplay);
    const hiddenCount = allNodes.length - displayNodes.length;

    for (const node of displayNodes) {
      const nodeEl = container.createDiv({
        cls: `learning-path-node ${this.getNodeStatusClass(node)}`,
      });

      // Status Icon
      const statusEl = nodeEl.createDiv({ cls: 'learning-path-node-status' });
      this.renderStatusIcon(statusEl, node);

      // Content
      const contentEl = nodeEl.createDiv({ cls: 'learning-path-node-content' });

      const titleEl = contentEl.createDiv({ cls: 'learning-path-node-title' });
      titleEl.createSpan({ text: `${node.order}. ` });
      const linkEl = titleEl.createEl('a', {
        text: node.title,
        cls: 'internal-link',
      });
      linkEl.addEventListener('click', () => this.openNote(node));

      const metaEl = contentEl.createDiv({ cls: 'learning-path-node-meta' });
      metaEl.createSpan({ text: `약 ${node.estimatedMinutes}분` });

      // Actions
      const actionsEl = nodeEl.createDiv({ cls: 'learning-path-node-actions' });
      this.renderNodeActions(actionsEl, path, node);
    }

    // Show hidden count if there are more nodes
    if (hiddenCount > 0) {
      const moreEl = container.createDiv({ cls: 'learning-path-more-nodes' });
      moreEl.createSpan({
        text: `... 외 ${hiddenCount}개 노드 (설정에서 표시 수 조정 가능)`,
      });
    }
  }

  /**
   * 노드 상태에 따른 CSS 클래스
   */
  private getNodeStatusClass(node: LearningNode): string {
    if (node.isCompleted()) return 'completed';
    if (node.isInProgress()) return 'in-progress';
    return 'not-started';
  }

  /**
   * 상태 아이콘 렌더링
   */
  private renderStatusIcon(container: Element, node: LearningNode): void {
    const iconEl = container.createDiv({ cls: 'status-icon' });

    if (node.isCompleted()) {
      setIcon(iconEl, 'check-circle-2');
      iconEl.addClass('completed');
    } else if (node.isInProgress()) {
      setIcon(iconEl, 'clock');
      iconEl.addClass('in-progress');
    } else {
      setIcon(iconEl, 'circle');
      iconEl.addClass('not-started');
    }
  }

  /**
   * 노드 액션 버튼 렌더링
   */
  private renderNodeActions(
    container: Element,
    path: LearningPath,
    node: LearningNode
  ): void {
    if (node.isNotStarted()) {
      const startBtn = container.createEl('button', {
        cls: 'learning-path-node-btn',
        attr: { 'aria-label': '학습 시작' },
      });
      setIcon(startBtn, 'play');
      startBtn.addEventListener('click', () =>
        this.updateNodeProgress(path.id, node.noteId, MasteryLevelValue.IN_PROGRESS)
      );
    } else if (node.isInProgress()) {
      const completeBtn = container.createEl('button', {
        cls: 'learning-path-node-btn',
        attr: { 'aria-label': '완료 표시' },
      });
      setIcon(completeBtn, 'check');
      completeBtn.addEventListener('click', () =>
        this.updateNodeProgress(path.id, node.noteId, MasteryLevelValue.COMPLETED)
      );
    } else {
      const resetBtn = container.createEl('button', {
        cls: 'learning-path-node-btn',
        attr: { 'aria-label': '다시 학습' },
      });
      setIcon(resetBtn, 'rotate-ccw');
      resetBtn.addEventListener('click', () =>
        this.updateNodeProgress(path.id, node.noteId, MasteryLevelValue.NOT_STARTED)
      );
    }
  }

  /**
   * 액션 버튼 렌더링
   */
  private renderActions(container: Element, path: LearningPath): void {
    if (path.isCompleted()) {
      const celebrateEl = container.createDiv({ cls: 'learning-path-celebrate' });
      celebrateEl.createEl('h4', { text: '🎉 학습 완료!' });
      celebrateEl.createEl('p', { text: '모든 노드를 완료했습니다.' });

      const resetBtn = container.createEl('button', {
        cls: 'mod-warning',
        text: '진행 상태 초기화',
      });
      resetBtn.addEventListener('click', () => this.resetAllProgress(path));
    } else {
      const continueEl = container.createDiv({ cls: 'learning-path-continue' });
      const currentNode = path.getCurrentNode();

      if (currentNode) {
        continueEl.createEl('span', { text: '다음: ' });
        const linkEl = continueEl.createEl('a', {
          text: currentNode.title,
          cls: 'internal-link mod-cta',
        });
        linkEl.addEventListener('click', () => this.openNote(currentNode));
      }
    }
  }

  /**
   * 경로 생성 또는 기존 경로 로드
   */
  private async showCreateDialog(): Promise<void> {
    if (!this.dependencies) {
      console.error('Dependencies not set');
      return;
    }

    // Get active file as goal note
    const activeFile = this.app.workspace.getActiveFile();
    // Note: NoteData.id uses basename, not full path
    const goalNoteId = activeFile?.basename;
    const goalNoteName = activeFile?.basename || '새 학습 경로';

    if (!goalNoteId) {
      new Notice('활성화된 노트가 없습니다.');
      return;
    }

    // Show loading state
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('learning-path-view');

    try {
      // Check if existing path exists for this goal note
      const existingPath = await this.dependencies.pathRepository.findByGoalNote(goalNoteId);

      if (existingPath) {
        // Load existing path
        await this.displayPath(existingPath);
        new Notice(`기존 학습 경로를 불러왔습니다: ${goalNoteName}`);
        return;
      }

      // No existing path, generate new one
      this.renderLoadingState(container, goalNoteName);

      // Build request
      const request: GeneratePathRequest = {
        name: goalNoteName,
        goalNoteId,
        useLLMAnalysis: true,
      };

      // Execute path generation
      const response = await this.dependencies.generatePathUseCase.execute(request);

      if (response.success && response.path) {
        // Convert path data to domain object and display
        const path = LearningPath.fromData(response.path);
        await this.displayPath(path);

        // Show warnings if any
        if (response.warnings && response.warnings.length > 0) {
          console.warn('학습 경로 생성 경고:', response.warnings);
        }
      } else {
        this.renderErrorState(container, response.error || '학습 경로 생성에 실패했습니다.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      this.renderErrorState(container, errorMessage);
    }
  }

  /**
   * 로딩 상태 렌더링
   */
  private renderLoadingState(container: Element, pathName: string): void {
    const loadingEl = container.createDiv({ cls: 'learning-path-loading' });

    const spinnerEl = loadingEl.createDiv({ cls: 'learning-path-spinner' });
    setIcon(spinnerEl, 'loader-2');

    loadingEl.createEl('h3', { text: '새 학습 경로를 생성 중입니다...' });
    loadingEl.createEl('p', { text: `목표: ${pathName}` });
    loadingEl.createEl('p', {
      cls: 'learning-path-loading-hint',
      text: 'LLM 분석 중... 잠시만 기다려 주세요.',
    });
  }

  /**
   * 에러 상태 렌더링
   */
  private renderErrorState(container: Element, errorMessage: string): void {
    container.empty();

    const errorEl = container.createDiv({ cls: 'learning-path-error' });

    const iconEl = errorEl.createDiv({ cls: 'learning-path-error-icon' });
    setIcon(iconEl, 'alert-circle');

    errorEl.createEl('h3', { text: '학습 경로 생성 실패' });
    errorEl.createEl('p', { text: errorMessage });

    const retryBtn = errorEl.createEl('button', {
      cls: 'mod-cta',
      text: '다시 시도',
    });
    retryBtn.addEventListener('click', () => this.showCreateDialog());

    const backBtn = errorEl.createEl('button', {
      text: '돌아가기',
    });
    backBtn.addEventListener('click', () => this.renderEmptyState(container));
  }

  /**
   * 경로 메뉴 표시
   */
  private showPathMenu(e: MouseEvent, path: LearningPath): void {
    // Will be implemented with menu
    console.log('Show path menu', path.id);
  }

  /**
   * 노트 열기
   */
  private async openNote(node: LearningNode): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(node.notePath);
    if (file) {
      await this.app.workspace.getLeaf().openFile(file as any);
    }
  }

  /**
   * 노드 진행 상태 업데이트
   */
  private async updateNodeProgress(
    pathId: string,
    nodeId: string,
    newLevel: MasteryLevelValue
  ): Promise<void> {
    console.log('[LearningPathView] updateNodeProgress called:', { pathId, nodeId, newLevel });

    if (!this.dependencies) {
      new Notice('오류: Dependencies not set');
      console.error('Dependencies not set');
      return;
    }

    if (!this.currentPath) {
      new Notice('오류: 현재 경로가 없습니다');
      console.error('No current path');
      return;
    }

    const request: UpdateProgressRequest = {
      pathId,
      nodeId,
      newLevel,
    };

    try {
      console.log('[LearningPathView] Executing updateProgressUseCase...');
      const response = await this.dependencies.updateProgressUseCase.execute(request);
      console.log('[LearningPathView] Response:', response);

      if (response.success) {
        // Update local currentPath with new progress
        const masteryLevel = this.valueToMasteryLevel(newLevel);
        this.currentPath = this.currentPath.updateNodeProgress(nodeId, masteryLevel);
        await this.refresh();
        new Notice('학습 상태가 업데이트되었습니다');
      } else {
        new Notice(`진행 상태 업데이트 실패: ${response.error}`);
        console.error('Failed to update progress:', response.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      new Notice(`오류 발생: ${errorMsg}`);
      console.error('Exception in updateNodeProgress:', error);
    }
  }

  /**
   * MasteryLevelValue를 MasteryLevel 객체로 변환
   */
  private valueToMasteryLevel(value: MasteryLevelValue): MasteryLevel {
    switch (value) {
      case MasteryLevelValue.IN_PROGRESS:
        return MasteryLevel.inProgress();
      case MasteryLevelValue.COMPLETED:
        return MasteryLevel.completed();
      default:
        return MasteryLevel.notStarted();
    }
  }

  /**
   * 전체 진행 상태 초기화
   */
  private async resetAllProgress(path: LearningPath): Promise<void> {
    const resetPath = path.resetAllProgress();
    this.currentPath = resetPath;
    await this.refresh();
  }
}
