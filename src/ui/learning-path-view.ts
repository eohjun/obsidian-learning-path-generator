/**
 * LearningPathView
 * Sidebar view for displaying learning paths
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
import { generateNoteId } from '../core/domain/utils/note-id';
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
    return 'Learning Path';
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
    this.currentPath = null;
    this.dependencies = null;
    this.containerEl.children[1]?.empty();
  }

  /**
   * Display learning path
   */
  async displayPath(path: LearningPath): Promise<void> {
    this.currentPath = path;
    await this.refresh();
  }

  /**
   * Refresh view
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
   * Render empty state
   */
  private renderEmptyState(container: Element): void {
    const emptyEl = container.createDiv({ cls: 'learning-path-empty' });

    const iconEl = emptyEl.createDiv({ cls: 'learning-path-empty-icon' });
    setIcon(iconEl, 'route');

    emptyEl.createEl('h3', { text: 'No Learning Path' });
    emptyEl.createEl('p', {
      text: 'Select a note and generate a learning path.',
    });

    const createBtn = emptyEl.createEl('button', {
      cls: 'mod-cta',
      text: 'Create New Learning Path',
    });
    createBtn.addEventListener('click', () => this.showCreateDialog());
  }

  /**
   * Render learning path
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
   * Render header
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
      attr: { 'aria-label': 'Create new learning path' },
    });
    setIcon(newPathBtn, 'plus');
    newPathBtn.addEventListener('click', () => this.showCreateDialog());

    // Delete path button
    const deleteBtn = actionsEl.createEl('button', {
      cls: 'learning-path-menu-btn clickable-icon',
      attr: { 'aria-label': 'Delete path' },
    });
    setIcon(deleteBtn, 'trash-2');
    deleteBtn.addEventListener('click', () => this.deletePath(path));

    // Close button (hide without deleting)
    const closeBtn = actionsEl.createEl('button', {
      cls: 'learning-path-menu-btn clickable-icon',
      attr: { 'aria-label': 'Close (without deleting)' },
    });
    setIcon(closeBtn, 'x');
    closeBtn.addEventListener('click', () => this.closePath());
  }

  /**
   * Close path (clear view without deleting)
   */
  private async closePath(): Promise<void> {
    this.currentPath = null;
    await this.refresh();
  }

  /**
   * Clear current path (can be called externally)
   * Called from main.ts before loading a different note's path
   */
  async clearCurrentPath(): Promise<void> {
    this.currentPath = null;
    await this.refresh();
  }

  /**
   * Show loading state (can be called externally)
   */
  async showLoadingState(goalNoteId: string): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('learning-path-view');
    this.renderLoadingState(container, goalNoteId);
  }

  /**
   * Show error state (can be called externally)
   */
  async showErrorState(message: string): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('learning-path-view');
    this.renderErrorState(container, message);
  }

  /**
   * Delete path (delete actual JSON file)
   */
  private async deletePath(path: LearningPath): Promise<void> {
    if (!this.dependencies) {
      new Notice('Error: Dependencies not set');
      return;
    }

    try {
      // Delete from repository (actual file deletion)
      await this.dependencies.pathRepository.delete(path.id);

      // Clear current path and show empty state
      this.currentPath = null;
      await this.refresh();
      new Notice('Learning path deleted');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      new Notice(`Delete failed: ${errorMsg}`);
      console.error('[LearningPathView] Delete failed:', error);
    }
  }

  /**
   * Render statistics
   */
  private renderStatistics(container: Element, stats: PathStatistics): void {
    const items = [
      {
        label: 'Completed',
        value: stats.completedNodes.toString(),
        icon: 'check-circle',
      },
      {
        label: 'In Progress',
        value: stats.inProgressNodes.toString(),
        icon: 'clock',
      },
      {
        label: 'Remaining',
        value: stats.remainingNodes().toString(),
        icon: 'circle',
      },
      {
        label: 'Est. Time',
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
   * Render progress bar
   */
  private renderProgressBar(container: Element, stats: PathStatistics): void {
    const percent = stats.progressPercent();

    const labelEl = container.createDiv({ cls: 'learning-path-progress-label' });
    labelEl.createSpan({ text: 'Progress' });
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
   * Render knowledge gaps section
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
    titleEl.createSpan({ text: gaps.length > 0 ? 'Knowledge Gaps Found' : 'Knowledge Gap Analysis' });

    // Stats
    const statsEl = headerEl.createDiv({ cls: 'learning-path-gaps-stats' });
    if (totalAnalyzedNotes > 0) {
      statsEl.createSpan({
        text: gaps.length > 0
          ? `${totalAnalyzedNotes} notes analyzed → ${gaps.length} gaps found`
          : `${totalAnalyzedNotes} notes analyzed`,
        cls: 'learning-path-gaps-count'
      });
    }

    // Empty state
    if (gaps.length === 0) {
      const emptyEl = container.createDiv({ cls: 'learning-path-gaps-empty' });
      emptyEl.createEl('p', {
        text: totalAnalyzedNotes > 0
          ? 'No knowledge gaps found. Your vault notes are sufficient for learning.'
          : 'Knowledge gap analysis was not performed. Check if AI analysis is enabled.',
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
      const priorityText = gap.priority === 'high' ? 'Required' : gap.priority === 'medium' ? 'Recommended' : 'Optional';
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
        resourcesEl.createSpan({ text: 'Resources: ', cls: 'learning-path-gap-resources-label' });
        resourcesEl.createSpan({
          text: gap.suggestedResources.join(', '),
          cls: 'learning-path-gap-resources-list'
        });
      }

      // Action button - search in vault
      const actionEl = gapEl.createDiv({ cls: 'learning-path-gap-action' });
      const searchBtn = actionEl.createEl('button', {
        cls: 'learning-path-gap-search-btn clickable-icon',
        attr: { 'aria-label': `Search "${gap.concept}"` }
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
      text: 'Adding notes on these topics will make your learning more complete.',
      cls: 'learning-path-gaps-help-text'
    });
  }

  /**
   * Render node list
   */
  private renderNodes(container: Element, path: LearningPath): void {
    const allNodes = path.nodes;
    const maxDisplay = this.dependencies?.getMaxDisplayNodes() ?? 50;
    const displayNodes = allNodes.slice(0, maxDisplay);
    const hiddenCount = allNodes.length - displayNodes.length;

    container.setAttribute('role', 'list');
    container.setAttribute('aria-label', 'Learning path nodes');

    for (const node of displayNodes) {
      const nodeEl = container.createDiv({
        cls: `learning-path-node ${this.getNodeStatusClass(node)}`,
        attr: {
          role: 'listitem',
          'aria-label': `${node.order}. ${node.title} — ${this.getNodeStatusClass(node).replace('-', ' ')}`,
        },
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
      metaEl.createSpan({ text: `~${node.estimatedMinutes} min` });

      // Actions
      const actionsEl = nodeEl.createDiv({ cls: 'learning-path-node-actions' });
      this.renderNodeActions(actionsEl, path, node);
    }

    // Show hidden count if there are more nodes
    if (hiddenCount > 0) {
      const moreEl = container.createDiv({ cls: 'learning-path-more-nodes' });
      moreEl.createSpan({
        text: `... and ${hiddenCount} more nodes (adjust display count in settings)`,
      });
    }
  }

  /**
   * Get CSS class based on node status
   */
  private getNodeStatusClass(node: LearningNode): string {
    if (node.isCompleted()) return 'completed';
    if (node.isInProgress()) return 'in-progress';
    return 'not-started';
  }

  /**
   * Render status icon
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
   * Render node action buttons
   */
  private renderNodeActions(
    container: Element,
    path: LearningPath,
    node: LearningNode
  ): void {
    if (node.isNotStarted()) {
      const startBtn = container.createEl('button', {
        cls: 'learning-path-node-btn',
        attr: { 'aria-label': 'Start learning' },
      });
      setIcon(startBtn, 'play');
      startBtn.addEventListener('click', () =>
        this.updateNodeProgress(path.id, node.noteId, MasteryLevelValue.IN_PROGRESS)
      );
    } else if (node.isInProgress()) {
      const completeBtn = container.createEl('button', {
        cls: 'learning-path-node-btn',
        attr: { 'aria-label': 'Mark complete' },
      });
      setIcon(completeBtn, 'check');
      completeBtn.addEventListener('click', () =>
        this.updateNodeProgress(path.id, node.noteId, MasteryLevelValue.COMPLETED)
      );
    } else {
      const resetBtn = container.createEl('button', {
        cls: 'learning-path-node-btn',
        attr: { 'aria-label': 'Study again' },
      });
      setIcon(resetBtn, 'rotate-ccw');
      resetBtn.addEventListener('click', () =>
        this.updateNodeProgress(path.id, node.noteId, MasteryLevelValue.NOT_STARTED)
      );
    }
  }

  /**
   * Render action buttons
   */
  private renderActions(container: Element, path: LearningPath): void {
    if (path.isCompleted()) {
      const celebrateEl = container.createDiv({ cls: 'learning-path-celebrate' });
      celebrateEl.createEl('h4', { text: 'Learning Complete!' });
      celebrateEl.createEl('p', { text: 'All nodes completed.' });

      const resetBtn = container.createEl('button', {
        cls: 'mod-warning',
        text: 'Reset Progress',
      });
      resetBtn.addEventListener('click', () => this.resetAllProgress(path));
    } else {
      const continueEl = container.createDiv({ cls: 'learning-path-continue' });
      const currentNode = path.getCurrentNode();

      if (currentNode) {
        continueEl.createEl('span', { text: 'Next: ' });
        const linkEl = continueEl.createEl('a', {
          text: currentNode.title,
          cls: 'internal-link mod-cta',
        });
        linkEl.addEventListener('click', () => this.openNote(currentNode));
      }
    }
  }

  /**
   * Create path or load existing path
   */
  private async showCreateDialog(): Promise<void> {
    if (!this.dependencies) {
      console.error('Dependencies not set');
      return;
    }

    // Get active file as goal note
    const activeFile = this.app.workspace.getActiveFile();
    // Hash-based ID for Vault Embeddings compatibility
    const goalNoteId = activeFile ? generateNoteId(activeFile.path) : undefined;
    const goalNoteName = activeFile?.basename || 'New Learning Path';

    if (!goalNoteId || !activeFile) {
      new Notice('No active note.');
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
        new Notice(`Loaded existing learning path: ${goalNoteName}`);
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
          console.warn('Learning path generation warnings:', response.warnings);
        }
      } else {
        this.renderErrorState(container, response.error || 'Failed to generate learning path.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      this.renderErrorState(container, errorMessage);
    }
  }

  /**
   * Render loading state
   */
  private renderLoadingState(container: Element, pathName: string): void {
    const loadingEl = container.createDiv({ cls: 'learning-path-loading' });

    const spinnerEl = loadingEl.createDiv({ cls: 'learning-path-spinner' });
    setIcon(spinnerEl, 'loader-2');

    loadingEl.createEl('h3', { text: 'Generating new learning path...' });
    loadingEl.createEl('p', { text: `Goal: ${pathName}` });
    loadingEl.createEl('p', {
      cls: 'learning-path-loading-hint',
      text: 'Analyzing with LLM... Please wait.',
    });
  }

  /**
   * Render error state
   */
  private renderErrorState(container: Element, errorMessage: string): void {
    container.empty();

    const errorEl = container.createDiv({ cls: 'learning-path-error' });

    const iconEl = errorEl.createDiv({ cls: 'learning-path-error-icon' });
    setIcon(iconEl, 'alert-circle');

    errorEl.createEl('h3', { text: 'Failed to Generate Learning Path' });
    errorEl.createEl('p', { text: errorMessage });

    const retryBtn = errorEl.createEl('button', {
      cls: 'mod-cta',
      text: 'Retry',
    });
    retryBtn.addEventListener('click', () => this.showCreateDialog());

    const backBtn = errorEl.createEl('button', {
      text: 'Go Back',
    });
    backBtn.addEventListener('click', () => this.renderEmptyState(container));
  }

  /**
   * Show path menu
   */
  private showPathMenu(e: MouseEvent, path: LearningPath): void {
    // Will be implemented with menu
    console.log('Show path menu', path.id);
  }

  /**
   * Open note
   */
  private async openNote(node: LearningNode): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(node.notePath);
    if (file) {
      await this.app.workspace.getLeaf().openFile(file as any);
    }
  }

  /**
   * Update node progress
   */
  private async updateNodeProgress(
    pathId: string,
    nodeId: string,
    newLevel: MasteryLevelValue
  ): Promise<void> {
    console.log('[LearningPathView] updateNodeProgress called:', { pathId, nodeId, newLevel });

    if (!this.dependencies) {
      new Notice('Error: Dependencies not set');
      console.error('Dependencies not set');
      return;
    }

    if (!this.currentPath) {
      new Notice('Error: No current path');
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
        new Notice('Progress updated');
      } else {
        new Notice(`Failed to update progress: ${response.error}`);
        console.error('Failed to update progress:', response.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      new Notice(`Error: ${errorMsg}`);
      console.error('Exception in updateNodeProgress:', error);
    }
  }

  /**
   * Convert MasteryLevelValue to MasteryLevel object
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
   * Reset all progress
   */
  private async resetAllProgress(path: LearningPath): Promise<void> {
    const resetPath = path.resetAllProgress();
    this.currentPath = resetPath;
    await this.refresh();
  }
}
