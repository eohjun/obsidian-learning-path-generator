/**
 * GenerateLearningPathUseCase
 * 학습 경로 생성 유스케이스
 *
 * 노트들 간의 링크 관계를 분석하여 학습 경로를 생성합니다.
 */

import {
  INoteRepository,
  NoteData,
  IPathRepository,
  DependencyAnalyzer,
  DependencyRelation,
  LearningPath,
  LearningNode,
  MasteryLevel,
} from '../../domain';
import {
  GeneratePathRequest,
  GeneratePathResponse,
} from '../dtos/generate-path.dto';

export class GenerateLearningPathUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly pathRepository: IPathRepository,
    private readonly dependencyAnalyzer: DependencyAnalyzer
  ) {}

  async execute(request: GeneratePathRequest): Promise<GeneratePathResponse> {
    const warnings: string[] = [];

    try {
      // 1. Fetch notes based on filter criteria
      const notes = await this.noteRepository.getAllNotes({
        folder: request.folder,
        excludeFolders: request.excludeFolders,
      });

      if (notes.length === 0) {
        return {
          success: false,
          error: 'No notes found matching the criteria',
        };
      }

      // 2. Determine target notes
      let targetNoteIds: string[];
      if (request.startNoteIds && request.startNoteIds.length > 0) {
        targetNoteIds = this.expandFromStartNotes(notes, request.startNoteIds);
      } else if (request.goalNoteId) {
        targetNoteIds = this.findPathToGoal(notes, request.goalNoteId);
      } else {
        targetNoteIds = notes.map((n) => n.id);
      }

      if (targetNoteIds.length === 0) {
        return {
          success: false,
          error: 'No valid notes found for path generation',
        };
      }

      // 3. Extract dependencies from link structure
      const dependencies = this.extractDependencies(notes, targetNoteIds);

      // 4. Build dependency graph
      const graph = this.dependencyAnalyzer.buildGraph(
        targetNoteIds,
        dependencies
      );

      // 5. Check for cycles
      const hasCycle = this.dependencyAnalyzer.detectCycle(graph);
      let sortedNodeIds: string[];

      if (hasCycle) {
        warnings.push(
          'Circular dependency detected. Some ordering may be arbitrary.'
        );
        // Fallback: use original order but remove cycle edges
        sortedNodeIds = this.sortWithCycleFallback(targetNoteIds, dependencies);
      } else {
        // 6. Topological sort for learning order
        sortedNodeIds = this.dependencyAnalyzer.topologicalSort(graph);
      }

      // 7. Get levels for parallel learning
      let levels: string[][] = [];
      if (!hasCycle) {
        try {
          levels = this.dependencyAnalyzer.getLevels(graph);
        } catch {
          // If getLevels fails, use single level
          levels = [sortedNodeIds];
        }
      } else {
        levels = [sortedNodeIds];
      }

      // 8. Create LearningNodes
      const nodeMap = new Map(notes.map((n) => [n.id, n]));
      const learningNodes: LearningNode[] = sortedNodeIds
        .map((id, index) => {
          const note = nodeMap.get(id);
          if (!note) return null;
          return LearningNode.create({
            noteId: id,
            notePath: note.path,
            title: note.basename,
            order: index,
            masteryLevel: MasteryLevel.notStarted(),
          });
        })
        .filter((n): n is LearningNode => n !== null);

      // 9. Determine goal note
      const goalNoteId =
        request.goalNoteId || sortedNodeIds[sortedNodeIds.length - 1];
      const goalNote = nodeMap.get(goalNoteId);
      const goalNoteTitle = request.name || goalNote?.basename || goalNoteId;

      // 10. Create LearningPath with nodes
      let path = LearningPath.create({
        id: this.generateId(),
        goalNoteId,
        goalNoteTitle,
        nodes: learningNodes,
      });

      // 11. Save path to repository
      await this.pathRepository.save(path);

      return {
        success: true,
        path: path.toData(),
        nodes: learningNodes.map((n) => n.toData()),
        levels,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * 시작 노트들로부터 연결된 노트들을 탐색하여 확장
   */
  private expandFromStartNotes(notes: NoteData[], startIds: string[]): string[] {
    const noteMap = new Map(notes.map((n) => [n.id, n]));
    const visited = new Set<string>();
    const queue = [...startIds];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      const note = noteMap.get(current);
      if (!note) continue;

      visited.add(current);

      // Add linked notes to queue
      const links = note.metadata.links ?? [];
      for (const link of links) {
        if (noteMap.has(link) && !visited.has(link)) {
          queue.push(link);
        }
      }
    }

    return Array.from(visited);
  }

  /**
   * 목표 노트까지의 경로에 필요한 모든 노트 찾기
   */
  private findPathToGoal(notes: NoteData[], goalId: string): string[] {
    const noteMap = new Map(notes.map((n) => [n.id, n]));
    const goalNote = noteMap.get(goalId);

    if (!goalNote) {
      return notes.map((n) => n.id);
    }

    // BFS to find all ancestors (prerequisites) of goal
    const ancestors = new Set<string>();
    const queue = [goalId];

    // Build reverse link map (what links TO each note)
    const reverseLinks = new Map<string, string[]>();
    for (const note of notes) {
      const links = note.metadata.links ?? [];
      for (const link of links) {
        if (!reverseLinks.has(link)) {
          reverseLinks.set(link, []);
        }
        reverseLinks.get(link)!.push(note.id);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (ancestors.has(current) && current !== goalId) continue;
      ancestors.add(current);

      // Get notes that link to current (potential prerequisites)
      const backlinks = noteMap.get(current)?.metadata.backlinks ?? [];
      const reverseLink = reverseLinks.get(current) ?? [];
      const allBacklinks = [...new Set([...backlinks, ...reverseLink])];

      for (const backlink of allBacklinks) {
        if (noteMap.has(backlink) && !ancestors.has(backlink)) {
          queue.push(backlink);
        }
      }
    }

    return Array.from(ancestors);
  }

  /**
   * 노트들의 링크 구조에서 의존 관계 추출
   *
   * A -> B 링크는 "A를 학습한 후 B로 진행"을 의미
   * 즉, A가 B의 선행조건 (A is prerequisite for B)
   */
  private extractDependencies(
    notes: NoteData[],
    targetIds: string[]
  ): DependencyRelation[] {
    const targetSet = new Set(targetIds);
    const dependencies: DependencyRelation[] = [];

    for (const note of notes) {
      if (!targetSet.has(note.id)) continue;

      const links = note.metadata.links ?? [];
      for (const link of links) {
        if (targetSet.has(link)) {
          // A -> B link means A is prerequisite for B
          // "After learning A, proceed to B"
          dependencies.push(
            DependencyRelation.prerequisite(note.id, link, 0.7)
          );
        }
      }
    }

    return dependencies;
  }

  /**
   * 순환 의존성이 있을 때 fallback 정렬
   */
  private sortWithCycleFallback(
    nodeIds: string[],
    dependencies: DependencyRelation[]
  ): string[] {
    // Simple topological sort ignoring back-edges
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    for (const id of nodeIds) {
      inDegree.set(id, 0);
      graph.set(id, []);
    }

    for (const dep of dependencies) {
      if (dep.isPrerequisite()) {
        graph.get(dep.sourceId)?.push(dep.targetId);
      }
    }

    // Calculate in-degrees
    for (const [, targets] of graph) {
      for (const target of targets) {
        inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
      }
    }

    const result: string[] = [];
    const queue: string[] = [];

    // Start with nodes having in-degree 0
    for (const [node, degree] of inDegree) {
      if (degree === 0) queue.push(node);
    }

    const visited = new Set<string>();
    while (queue.length > 0) {
      queue.sort();
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      result.push(current);

      for (const neighbor of graph.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0 && !visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    // Add remaining nodes (in cycle)
    for (const id of nodeIds) {
      if (!visited.has(id)) {
        result.push(id);
      }
    }

    return result;
  }

  /**
   * 순환 의존성을 제거한 의존 관계 반환
   */
  private removeCyclicDependencies(
    dependencies: DependencyRelation[],
    sortedIds: string[]
  ): DependencyRelation[] {
    const orderMap = new Map(sortedIds.map((id, i) => [id, i]));

    return dependencies.filter((dep) => {
      const sourceOrder = orderMap.get(dep.sourceId) ?? -1;
      const targetOrder = orderMap.get(dep.targetId) ?? -1;
      // Keep only forward edges
      return sourceOrder < targetOrder;
    });
  }

  /**
   * 유니크 ID 생성
   */
  private generateId(): string {
    return `path-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
