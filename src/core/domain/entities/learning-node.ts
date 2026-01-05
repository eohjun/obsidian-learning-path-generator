/**
 * LearningNode Entity
 * 학습 경로 내의 개별 노드(노트)를 나타내는 엔티티
 */

import { MasteryLevel } from '../value-objects/mastery-level';
import { DependencyRelation } from '../value-objects/dependency-relation';

export interface LearningNodeData {
  noteId: string;
  notePath: string;
  title: string;
  order: number;
  masteryLevel: string;
  dependencies: Array<{
    sourceId: string;
    targetId: string;
    type: string;
    confidence: number;
  }>;
  lastStudied?: string;
  estimatedMinutes?: number;
}

export class LearningNode {
  private constructor(
    private readonly _noteId: string,
    private readonly _notePath: string,
    private readonly _title: string,
    private _order: number,
    private _masteryLevel: MasteryLevel,
    private readonly _dependencies: DependencyRelation[],
    private _lastStudied: Date | null,
    private readonly _estimatedMinutes: number
  ) {}

  // Getters
  get noteId(): string {
    return this._noteId;
  }

  get notePath(): string {
    return this._notePath;
  }

  get title(): string {
    return this._title;
  }

  get order(): number {
    return this._order;
  }

  get masteryLevel(): MasteryLevel {
    return this._masteryLevel;
  }

  get dependencies(): ReadonlyArray<DependencyRelation> {
    return this._dependencies;
  }

  get lastStudied(): Date | null {
    return this._lastStudied;
  }

  get estimatedMinutes(): number {
    return this._estimatedMinutes;
  }

  // Factory methods
  static create(params: {
    noteId: string;
    notePath: string;
    title: string;
    order?: number;
    masteryLevel?: MasteryLevel;
    dependencies?: DependencyRelation[];
    lastStudied?: Date | null;
    estimatedMinutes?: number;
  }): LearningNode {
    if (!params.noteId || !params.notePath) {
      throw new Error('Note ID and path are required');
    }

    return new LearningNode(
      params.noteId,
      params.notePath,
      params.title || params.noteId,
      params.order ?? 0,
      params.masteryLevel ?? MasteryLevel.notStarted(),
      params.dependencies ?? [],
      params.lastStudied ?? null,
      params.estimatedMinutes ?? 15
    );
  }

  static fromData(data: LearningNodeData): LearningNode {
    const dependencies = data.dependencies.map((d) =>
      DependencyRelation.fromObject(d)
    );

    return new LearningNode(
      data.noteId,
      data.notePath,
      data.title,
      data.order,
      MasteryLevel.fromString(data.masteryLevel),
      dependencies,
      data.lastStudied ? new Date(data.lastStudied) : null,
      data.estimatedMinutes ?? 15
    );
  }

  // Status checks
  isCompleted(): boolean {
    return this._masteryLevel.isCompleted();
  }

  isInProgress(): boolean {
    return this._masteryLevel.isInProgress();
  }

  isNotStarted(): boolean {
    return this._masteryLevel.isNotStarted();
  }

  hasPrerequisites(): boolean {
    return this._dependencies.some((d) => d.isPrerequisite());
  }

  getPrerequisites(): DependencyRelation[] {
    return this._dependencies.filter((d) => d.isPrerequisite());
  }

  // Mutations (return new instance for immutability in domain logic)
  startLearning(): LearningNode {
    return new LearningNode(
      this._noteId,
      this._notePath,
      this._title,
      this._order,
      this._masteryLevel.startLearning(),
      this._dependencies,
      new Date(),
      this._estimatedMinutes
    );
  }

  complete(): LearningNode {
    return new LearningNode(
      this._noteId,
      this._notePath,
      this._title,
      this._order,
      this._masteryLevel.complete(),
      this._dependencies,
      new Date(),
      this._estimatedMinutes
    );
  }

  reset(): LearningNode {
    return new LearningNode(
      this._noteId,
      this._notePath,
      this._title,
      this._order,
      this._masteryLevel.reset(),
      this._dependencies,
      null,
      this._estimatedMinutes
    );
  }

  withOrder(order: number): LearningNode {
    return new LearningNode(
      this._noteId,
      this._notePath,
      this._title,
      order,
      this._masteryLevel,
      this._dependencies,
      this._lastStudied,
      this._estimatedMinutes
    );
  }

  withDependencies(dependencies: DependencyRelation[]): LearningNode {
    return new LearningNode(
      this._noteId,
      this._notePath,
      this._title,
      this._order,
      this._masteryLevel,
      dependencies,
      this._lastStudied,
      this._estimatedMinutes
    );
  }

  // Serialization
  toData(): LearningNodeData {
    return {
      noteId: this._noteId,
      notePath: this._notePath,
      title: this._title,
      order: this._order,
      masteryLevel: this._masteryLevel.toString(),
      dependencies: this._dependencies.map((d) => d.toObject()),
      lastStudied: this._lastStudied?.toISOString(),
      estimatedMinutes: this._estimatedMinutes,
    };
  }

  toDisplayString(): string {
    const icon = this._masteryLevel.toIcon();
    return `${icon} ${this._order}. ${this._title}`;
  }
}
