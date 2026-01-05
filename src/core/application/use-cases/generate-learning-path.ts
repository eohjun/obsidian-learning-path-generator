/**
 * GenerateLearningPathUseCase
 * 학습 경로 생성 유스케이스
 *
 * LLM을 사용하여 노트 내용을 분석하고 최적의 학습 경로를 생성합니다.
 * LLM이 없으면 링크 기반 분석으로 fallback합니다.
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
import { AIService } from '../services';

export class GenerateLearningPathUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly pathRepository: IPathRepository,
    private readonly dependencyAnalyzer: DependencyAnalyzer,
    private readonly aiService?: AIService
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
      console.log('[GeneratePath] request:', {
        goalNoteId: request.goalNoteId,
        startNoteIds: request.startNoteIds,
        folder: request.folder,
      });

      let targetNoteIds: string[];
      if (request.startNoteIds && request.startNoteIds.length > 0) {
        console.log('[GeneratePath] Using expandFromStartNotes');
        targetNoteIds = this.expandFromStartNotes(notes, request.startNoteIds);
      } else if (request.goalNoteId) {
        console.log('[GeneratePath] Using findPathToGoal');
        targetNoteIds = this.findPathToGoal(notes, request.goalNoteId);
      } else {
        console.log('[GeneratePath] Using all notes');
        targetNoteIds = notes.map((n) => n.id);
      }
      console.log('[GeneratePath] targetNoteIds count:', targetNoteIds.length);

      if (targetNoteIds.length === 0) {
        return {
          success: false,
          error: 'No valid notes found for path generation',
        };
      }

      // 3. Get target notes data
      const nodeMap = new Map(notes.map((n) => [n.id, n]));
      const targetNotes = targetNoteIds
        .map((id) => nodeMap.get(id))
        .filter((n): n is NoteData => n !== null);

      // 4. Determine goal note
      const goalNoteId =
        request.goalNoteId || targetNoteIds[targetNoteIds.length - 1];
      const goalNote = nodeMap.get(goalNoteId);

      if (!goalNote) {
        return {
          success: false,
          error: `Goal note not found: ${goalNoteId}`,
        };
      }

      // 5. Try LLM analysis first, fallback to link-based
      let sortedNodeIds: string[];
      let levels: string[][] = [];
      let estimatedMinutes: Record<string, number> = {};
      let knowledgeGaps: string[] = [];

      const useLLM = request.useLLMAnalysis !== false && this.aiService;

      if (useLLM && this.aiService!.isAvailable()) {
        // LLM-powered analysis
        const llmResult = await this.analyzewithLLM(goalNote, targetNotes);

        if (llmResult.success) {
          sortedNodeIds = llmResult.learningOrder;
          estimatedMinutes = llmResult.estimatedMinutes;
          knowledgeGaps = llmResult.knowledgeGaps;
          levels = [sortedNodeIds]; // Simple single level for now

          if (knowledgeGaps.length > 0) {
            warnings.push(`지식 갭 발견: ${knowledgeGaps.join(', ')}`);
          }
        } else {
          warnings.push(`LLM 분석 실패, 링크 기반 분석으로 전환: ${llmResult.error}`);
          const linkResult = this.analyzeWithLinks(targetNoteIds, notes);
          sortedNodeIds = linkResult.sortedIds;
          levels = linkResult.levels;
          if (linkResult.hasCycle) {
            warnings.push('Circular dependency detected. Some ordering may be arbitrary.');
          }
        }
      } else {
        // Link-based analysis (fallback)
        if (!useLLM) {
          warnings.push('LLM 분석이 비활성화되어 링크 기반 분석을 수행합니다.');
        }
        const linkResult = this.analyzeWithLinks(targetNoteIds, notes);
        sortedNodeIds = linkResult.sortedIds;
        levels = linkResult.levels;
        if (linkResult.hasCycle) {
          warnings.push('Circular dependency detected. Some ordering may be arbitrary.');
        }
      }

      // 6. Create LearningNodes
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
            estimatedMinutes: estimatedMinutes[note.basename] || 15,
          });
        })
        .filter((n): n is LearningNode => n !== null);

      // 7. Determine goal note title
      const goalNoteTitle = request.name || goalNote?.basename || goalNoteId;

      // 8. Create LearningPath with nodes
      const path = LearningPath.create({
        id: this.generateId(),
        goalNoteId,
        goalNoteTitle,
        nodes: learningNodes,
      });

      // 9. Save path to repository
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
   * LLM을 사용한 학습 경로 분석
   */
  private async analyzewithLLM(
    goalNote: NoteData,
    targetNotes: NoteData[]
  ): Promise<{
    success: boolean;
    learningOrder: string[];
    estimatedMinutes: Record<string, number>;
    knowledgeGaps: string[];
    error?: string;
  }> {
    if (!this.aiService || !this.aiService.isAvailable()) {
      return {
        success: false,
        learningOrder: [],
        estimatedMinutes: {},
        knowledgeGaps: [],
        error: 'AI service not available',
      };
    }

    const relatedNotes = targetNotes
      .filter((n) => n.id !== goalNote.id)
      .map((n) => ({ title: n.basename, content: n.content }));

    const result = await this.aiService.analyzeNotesForLearningPath(
      { title: goalNote.basename, content: goalNote.content },
      relatedNotes
    );

    if (result.success && result.data) {
      return {
        success: true,
        learningOrder: result.data.learningOrder,
        estimatedMinutes: result.data.estimatedMinutes,
        knowledgeGaps: result.data.knowledgeGaps,
      };
    }

    return {
      success: false,
      learningOrder: [],
      estimatedMinutes: {},
      knowledgeGaps: [],
      error: result.error || 'LLM analysis failed',
    };
  }

  /**
   * 링크 기반 학습 경로 분석 (fallback)
   */
  private analyzeWithLinks(
    targetNoteIds: string[],
    notes: NoteData[]
  ): {
    sortedIds: string[];
    levels: string[][];
    hasCycle: boolean;
  } {
    // Extract dependencies from link structure
    const dependencies = this.extractDependencies(notes, targetNoteIds);

    // Build dependency graph
    const graph = this.dependencyAnalyzer.buildGraph(targetNoteIds, dependencies);

    // Check for cycles
    const hasCycle = this.dependencyAnalyzer.detectCycle(graph);
    let sortedIds: string[];
    let levels: string[][] = [];

    if (hasCycle) {
      sortedIds = this.sortWithCycleFallback(targetNoteIds, dependencies);
      levels = [sortedIds];
    } else {
      sortedIds = this.dependencyAnalyzer.topologicalSort(graph);
      try {
        levels = this.dependencyAnalyzer.getLevels(graph);
      } catch {
        levels = [sortedIds];
      }
    }

    return { sortedIds, levels, hasCycle };
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
   * 목표 노트의 선수 지식(prerequisites) 찾기
   *
   * 알고리즘: 목표 노트가 링크하는 노트들을 재귀적으로 탐색
   * A → B 링크 = "A가 B를 참조" = "A를 이해하려면 B를 먼저 알아야 함"
   * 따라서 forward links를 따라가며 선수 지식을 찾음
   *
   * @param maxDepth - 최대 탐색 깊이 (기본값: 3)
   * @param maxNodes - 최대 노드 수 (기본값: 30)
   */
  private findPathToGoal(
    notes: NoteData[],
    goalId: string,
    maxDepth: number = 3,
    maxNodes: number = 30
  ): string[] {
    const noteMap = new Map(notes.map((n) => [n.id, n]));
    const goalNote = noteMap.get(goalId);

    if (!goalNote) {
      // Goal not found - return only direct folder neighbors or empty
      return [];
    }

    // BFS to find prerequisites (what the goal note depends on)
    const prerequisites = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [
      { id: goalId, depth: 0 },
    ];

    console.log(`[findPathToGoal] Starting BFS for goal: ${goalId}, maxNodes: ${maxNodes}, maxDepth: ${maxDepth}`);

    while (queue.length > 0) {
      const { id: current, depth } = queue.shift()!;

      if (prerequisites.has(current) && current !== goalId) continue;
      prerequisites.add(current);

      // Stop if max nodes reached
      if (prerequisites.size >= maxNodes) {
        console.log(`[findPathToGoal] Max nodes (${maxNodes}) reached, stopping`);
        break;
      }

      // Stop if max depth reached
      if (depth >= maxDepth) continue;

      // Get notes that current note LINKS TO (forward links = dependencies)
      const currentNote = noteMap.get(current);
      if (!currentNote) continue;

      const forwardLinks = currentNote.metadata.links ?? [];

      for (const link of forwardLinks) {
        // Only include notes that exist in our note set
        if (noteMap.has(link) && !prerequisites.has(link)) {
          queue.push({ id: link, depth: depth + 1 });
        }
      }
    }

    console.log(`[findPathToGoal] Result: ${prerequisites.size} nodes found`);
    return Array.from(prerequisites);
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
        // Skip self-referencing links
        if (targetSet.has(link) && link !== note.id) {
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
   * 유니크 ID 생성
   */
  private generateId(): string {
    return `path-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
