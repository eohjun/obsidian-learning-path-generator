/**
 * LearningPathView
 * 학습 경로를 표시하는 사이드바 뷰
 */

import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import {
  LearningPath,
  LearningNode,
  MasteryLevelValue,
  PathStatistics,
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
}

export class LearningPathView extends ItemView {
  private currentPath: LearningPath | null = null;
  private dependencies: LearningPathViewDependencies | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  setDependencies(deps: LearningPathViewDependencies): void {
    this.dependencies = deps;
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
   * 학습 경로 렌더링
   */
  private renderPath(container: Element, path: LearningPath): void {
    // Header
    const header = container.createDiv({ cls: 'learning-path-header' });
    this.renderHeader(header, path);

    // Statistics
    const statsEl = container.createDiv({ cls: 'learning-path-stats' });
    this.renderStatistics(statsEl, path.getStatistics());

    // Progress Bar
    const progressEl = container.createDiv({ cls: 'learning-path-progress' });
    this.renderProgressBar(progressEl, path.getStatistics());

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

    const menuBtn = container.createEl('button', {
      cls: 'learning-path-menu-btn clickable-icon',
    });
    setIcon(menuBtn, 'more-vertical');
    menuBtn.addEventListener('click', (e) => this.showPathMenu(e, path));
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
   * 노드 목록 렌더링
   */
  private renderNodes(container: Element, path: LearningPath): void {
    const nodes = path.nodes;

    for (const node of nodes) {
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
   * 경로 생성 다이얼로그
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

    // Show loading state
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('learning-path-view');
    this.renderLoadingState(container, goalNoteName);

    try {
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
    if (!this.dependencies) {
      console.error('Dependencies not set');
      return;
    }

    const request: UpdateProgressRequest = {
      pathId,
      nodeId,
      newLevel,
    };

    const response = await this.dependencies.updateProgressUseCase.execute(request);

    if (response.success) {
      await this.refresh();
    } else {
      console.error('Failed to update progress:', response.error);
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
