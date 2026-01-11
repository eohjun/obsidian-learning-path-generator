/**
 * PathStatistics Value Object
 * Immutable value object representing learning path statistics
 */

export interface PathStatisticsData {
  totalNodes: number;
  completedNodes: number;
  inProgressNodes: number;
  notStartedNodes: number;
  estimatedMinutes: number;
}

export class PathStatistics {
  private constructor(
    private readonly _totalNodes: number,
    private readonly _completedNodes: number,
    private readonly _inProgressNodes: number,
    private readonly _notStartedNodes: number,
    private readonly _estimatedMinutes: number
  ) {}

  // Getters
  get totalNodes(): number {
    return this._totalNodes;
  }

  get completedNodes(): number {
    return this._completedNodes;
  }

  get inProgressNodes(): number {
    return this._inProgressNodes;
  }

  get notStartedNodes(): number {
    return this._notStartedNodes;
  }

  get estimatedMinutes(): number {
    return this._estimatedMinutes;
  }

  // Factory methods
  static create(data: PathStatisticsData): PathStatistics {
    return new PathStatistics(
      data.totalNodes,
      data.completedNodes,
      data.inProgressNodes,
      data.notStartedNodes,
      data.estimatedMinutes
    );
  }

  static empty(): PathStatistics {
    return new PathStatistics(0, 0, 0, 0, 0);
  }

  static fromNodes(
    total: number,
    completed: number,
    inProgress: number,
    minutesPerNode: number = 15
  ): PathStatistics {
    const notStarted = total - completed - inProgress;
    const remainingNodes = total - completed;
    const estimatedMinutes = remainingNodes * minutesPerNode;

    return new PathStatistics(
      total,
      completed,
      inProgress,
      notStarted,
      estimatedMinutes
    );
  }

  // Calculations
  progressPercent(): number {
    if (this._totalNodes === 0) return 0;
    return Math.round((this._completedNodes / this._totalNodes) * 100);
  }

  remainingNodes(): number {
    return this._totalNodes - this._completedNodes;
  }

  estimatedHours(): number {
    return Math.round((this._estimatedMinutes / 60) * 10) / 10;
  }

  isCompleted(): boolean {
    return this._completedNodes === this._totalNodes && this._totalNodes > 0;
  }

  isEmpty(): boolean {
    return this._totalNodes === 0;
  }

  // Immutable update
  withUpdatedProgress(
    completed: number,
    inProgress: number,
    minutesPerNode: number = 15
  ): PathStatistics {
    return PathStatistics.fromNodes(
      this._totalNodes,
      completed,
      inProgress,
      minutesPerNode
    );
  }

  // Serialization
  toObject(): PathStatisticsData {
    return {
      totalNodes: this._totalNodes,
      completedNodes: this._completedNodes,
      inProgressNodes: this._inProgressNodes,
      notStartedNodes: this._notStartedNodes,
      estimatedMinutes: this._estimatedMinutes,
    };
  }

  toDisplayString(): string {
    const percent = this.progressPercent();
    const hours = this.estimatedHours();
    return `${this._completedNodes}/${this._totalNodes} (${percent}%) - Est. ${hours}h`;
  }

  toProgressBar(width: number = 20): string {
    const filled = Math.round((this.progressPercent() / 100) * width);
    const empty = width - filled;
    return '━'.repeat(filled) + '░'.repeat(empty);
  }
}
