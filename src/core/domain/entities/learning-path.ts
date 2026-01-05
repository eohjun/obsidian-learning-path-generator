/**
 * LearningPath Entity (Aggregate Root)
 * 학습 경로를 나타내는 핵심 엔티티
 *
 * 목표 노트까지의 학습 순서와 진행 상태를 관리
 */

import { LearningNode, LearningNodeData } from './learning-node';
import { PathStatistics } from '../value-objects/path-statistics';
import { MasteryLevel } from '../value-objects/mastery-level';
import { KnowledgeGapItem } from '../interfaces';

export interface LearningPathData {
  id: string;
  goalNoteId: string;
  goalNoteTitle: string;
  nodes: LearningNodeData[];
  knowledgeGaps?: KnowledgeGapItem[];
  totalAnalyzedNotes?: number;
  createdAt: string;
  updatedAt: string;
}

export class LearningPath {
  private constructor(
    private readonly _id: string,
    private readonly _goalNoteId: string,
    private readonly _goalNoteTitle: string,
    private _nodes: LearningNode[],
    private readonly _knowledgeGaps: KnowledgeGapItem[],
    private readonly _totalAnalyzedNotes: number,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  // Getters
  get id(): string {
    return this._id;
  }

  get goalNoteId(): string {
    return this._goalNoteId;
  }

  get goalNoteTitle(): string {
    return this._goalNoteTitle;
  }

  get nodes(): ReadonlyArray<LearningNode> {
    return this._nodes;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get knowledgeGaps(): ReadonlyArray<KnowledgeGapItem> {
    return this._knowledgeGaps;
  }

  get totalAnalyzedNotes(): number {
    return this._totalAnalyzedNotes;
  }

  // Factory methods
  static create(params: {
    id: string;
    goalNoteId: string;
    goalNoteTitle: string;
    nodes?: LearningNode[];
    knowledgeGaps?: KnowledgeGapItem[];
    totalAnalyzedNotes?: number;
  }): LearningPath {
    if (!params.id || !params.goalNoteId) {
      throw new Error('ID and goal note ID are required');
    }

    const now = new Date();
    return new LearningPath(
      params.id,
      params.goalNoteId,
      params.goalNoteTitle || params.goalNoteId,
      params.nodes ?? [],
      params.knowledgeGaps ?? [],
      params.totalAnalyzedNotes ?? 0,
      now,
      now
    );
  }

  static fromData(data: LearningPathData): LearningPath {
    const nodes = data.nodes.map((n) => LearningNode.fromData(n));

    return new LearningPath(
      data.id,
      data.goalNoteId,
      data.goalNoteTitle,
      nodes,
      data.knowledgeGaps ?? [],
      data.totalAnalyzedNotes ?? 0,
      new Date(data.createdAt),
      new Date(data.updatedAt)
    );
  }

  static generateId(): string {
    return `path-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // Node operations
  addNode(node: LearningNode): LearningPath {
    const existingIndex = this._nodes.findIndex(
      (n) => n.noteId === node.noteId
    );

    let newNodes: LearningNode[];
    if (existingIndex >= 0) {
      // Update existing node
      newNodes = [...this._nodes];
      newNodes[existingIndex] = node;
    } else {
      // Add new node
      const order = this._nodes.length + 1;
      newNodes = [...this._nodes, node.withOrder(order)];
    }

    return new LearningPath(
      this._id,
      this._goalNoteId,
      this._goalNoteTitle,
      newNodes,
      this._knowledgeGaps,
      this._totalAnalyzedNotes,
      this._createdAt,
      new Date()
    );
  }

  removeNode(noteId: string): LearningPath {
    const newNodes = this._nodes
      .filter((n) => n.noteId !== noteId)
      .map((node, index) => node.withOrder(index + 1));

    return new LearningPath(
      this._id,
      this._goalNoteId,
      this._goalNoteTitle,
      newNodes,
      this._knowledgeGaps,
      this._totalAnalyzedNotes,
      this._createdAt,
      new Date()
    );
  }

  setNodes(nodes: LearningNode[]): LearningPath {
    const orderedNodes = nodes.map((node, index) => node.withOrder(index + 1));

    return new LearningPath(
      this._id,
      this._goalNoteId,
      this._goalNoteTitle,
      orderedNodes,
      this._knowledgeGaps,
      this._totalAnalyzedNotes,
      this._createdAt,
      new Date()
    );
  }

  // Progress operations
  updateNodeProgress(noteId: string, masteryLevel: MasteryLevel): LearningPath {
    const newNodes = this._nodes.map((node) => {
      if (node.noteId === noteId) {
        if (masteryLevel.isCompleted()) {
          return node.complete();
        } else if (masteryLevel.isInProgress()) {
          return node.startLearning();
        } else {
          return node.reset();
        }
      }
      return node;
    });

    return new LearningPath(
      this._id,
      this._goalNoteId,
      this._goalNoteTitle,
      newNodes,
      this._knowledgeGaps,
      this._totalAnalyzedNotes,
      this._createdAt,
      new Date()
    );
  }

  markNodeCompleted(noteId: string): LearningPath {
    return this.updateNodeProgress(noteId, MasteryLevel.completed());
  }

  markNodeInProgress(noteId: string): LearningPath {
    return this.updateNodeProgress(noteId, MasteryLevel.inProgress());
  }

  resetNode(noteId: string): LearningPath {
    return this.updateNodeProgress(noteId, MasteryLevel.notStarted());
  }

  resetAllProgress(): LearningPath {
    const newNodes = this._nodes.map((node) => node.reset());

    return new LearningPath(
      this._id,
      this._goalNoteId,
      this._goalNoteTitle,
      newNodes,
      this._knowledgeGaps,
      this._totalAnalyzedNotes,
      this._createdAt,
      new Date()
    );
  }

  // Query methods
  getNode(noteId: string): LearningNode | undefined {
    return this._nodes.find((n) => n.noteId === noteId);
  }

  getNodeByOrder(order: number): LearningNode | undefined {
    return this._nodes.find((n) => n.order === order);
  }

  getCurrentNode(): LearningNode | undefined {
    // Find first incomplete node
    return this._nodes.find((n) => !n.isCompleted());
  }

  getCompletedNodes(): LearningNode[] {
    return this._nodes.filter((n) => n.isCompleted());
  }

  getInProgressNodes(): LearningNode[] {
    return this._nodes.filter((n) => n.isInProgress());
  }

  getNotStartedNodes(): LearningNode[] {
    return this._nodes.filter((n) => n.isNotStarted());
  }

  // Statistics
  getStatistics(): PathStatistics {
    const completed = this.getCompletedNodes().length;
    const inProgress = this.getInProgressNodes().length;
    const totalMinutes = this._nodes.reduce(
      (sum, n) => sum + n.estimatedMinutes,
      0
    );
    const avgMinutesPerNode =
      this._nodes.length > 0 ? totalMinutes / this._nodes.length : 15;

    return PathStatistics.fromNodes(
      this._nodes.length,
      completed,
      inProgress,
      avgMinutesPerNode
    );
  }

  isCompleted(): boolean {
    return (
      this._nodes.length > 0 && this._nodes.every((n) => n.isCompleted())
    );
  }

  isEmpty(): boolean {
    return this._nodes.length === 0;
  }

  // Validation
  hasCircularDependency(): boolean {
    // Build adjacency list
    const graph = new Map<string, string[]>();
    for (const node of this._nodes) {
      graph.set(node.noteId, []);
    }
    for (const node of this._nodes) {
      for (const dep of node.getPrerequisites()) {
        const edges = graph.get(dep.targetId);
        if (edges) {
          edges.push(dep.sourceId);
        }
      }
    }

    // DFS to detect cycle
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const edges = graph.get(nodeId) ?? [];
      for (const neighbor of edges) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of this._nodes) {
      if (!visited.has(node.noteId)) {
        if (hasCycle(node.noteId)) return true;
      }
    }

    return false;
  }

  // Serialization
  toData(): LearningPathData {
    return {
      id: this._id,
      goalNoteId: this._goalNoteId,
      goalNoteTitle: this._goalNoteTitle,
      nodes: this._nodes.map((n) => n.toData()),
      knowledgeGaps: this._knowledgeGaps.length > 0 ? [...this._knowledgeGaps] : undefined,
      totalAnalyzedNotes: this._totalAnalyzedNotes > 0 ? this._totalAnalyzedNotes : undefined,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  toDisplayString(): string {
    const stats = this.getStatistics();
    return `🎯 ${this._goalNoteTitle} - ${stats.toDisplayString()}`;
  }
}
