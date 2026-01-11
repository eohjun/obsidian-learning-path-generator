/**
 * GenerateLearningPathUseCase
 * Learning path generation use case
 *
 * New algorithm (v0.4.0):
 * 1. Extract prerequisite concepts from goal note using LLM
 * 2. Find matching notes for each concept using semantic search
 * 3. Determine learning order and identify knowledge gaps using LLM
 *
 * Fallback: Link-based BFS traversal (when LLM or semantic search unavailable)
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
  KnowledgeGapItem,
  ISemanticSearchService,
  ConceptExtractionResult,
} from '../../domain';
import {
  GeneratePathRequest,
  GeneratePathResponse,
} from '../dtos/generate-path.dto';
import { AIService } from '../services';

export class GenerateLearningPathUseCase {
  private semanticSearchService: ISemanticSearchService | null = null;

  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly pathRepository: IPathRepository,
    private readonly dependencyAnalyzer: DependencyAnalyzer,
    private readonly aiService?: AIService
  ) {}

  /**
   * Set semantic search service (PKM Note Recommender integration)
   */
  setSemanticSearchService(service: ISemanticSearchService | null): void {
    this.semanticSearchService = service;
  }

  async execute(request: GeneratePathRequest): Promise<GeneratePathResponse> {
    const warnings: string[] = [];

    try {
      // 1. Get all notes for reference
      const allNotes = await this.noteRepository.getAllNotes({
        folder: request.folder,
        excludeFolders: request.excludeFolders,
      });

      if (allNotes.length === 0) {
        return {
          success: false,
          error: 'No notes found matching the criteria',
        };
      }

      const noteMap = new Map(allNotes.map((n) => [n.id, n]));

      // 2. Get goal note
      const goalNoteId = request.goalNoteId;
      if (!goalNoteId) {
        return {
          success: false,
          error: 'Goal note ID is required',
        };
      }

      const goalNote = noteMap.get(goalNoteId);
      if (!goalNote) {
        return {
          success: false,
          error: `Goal note not found: ${goalNoteId}`,
        };
      }

      // 3. Choose algorithm based on available services
      const useLLM = (request.useLLMAnalysis !== false && this.aiService?.isAvailable()) ?? false;
      const useSemanticSearch = this.semanticSearchService?.isAvailable() ?? false;

      // Debug log
      console.log('[LearningPath] Algorithm selection:', {
        useLLM,
        useSemanticSearch,
        aiServiceExists: !!this.aiService,
        aiServiceAvailable: this.aiService?.isAvailable() ?? false,
        semanticServiceExists: !!this.semanticSearchService,
        semanticServiceAvailable: this.semanticSearchService?.isAvailable() ?? false,
        requestUseLLMAnalysis: request.useLLMAnalysis,
      });

      let sortedNodeIds: string[];
      let levels: string[][] = [];
      let estimatedMinutes: Record<string, number> = {};
      let knowledgeGaps: KnowledgeGapItem[] = [];
      let totalAnalyzedNotes = 0;

      if (useLLM && useSemanticSearch) {
        // New algorithm: LLM concept extraction + semantic search
        console.log('[LearningPath] ✓ Using NEW semantic search algorithm');
        const result = await this.executeWithSemanticSearch(goalNote, allNotes, noteMap);

        if (result.success) {
          sortedNodeIds = result.sortedNodeIds;
          estimatedMinutes = result.estimatedMinutes;
          knowledgeGaps = result.knowledgeGaps;
          totalAnalyzedNotes = result.totalAnalyzedNotes;
          levels = [sortedNodeIds];
        } else {
          // Fallback to link-based
          warnings.push(`Semantic search failed, switching to link-based analysis: ${result.error}`);
          const fallbackResult = await this.executeFallback(goalNote, allNotes, noteMap, useLLM);
          sortedNodeIds = fallbackResult.sortedNodeIds;
          estimatedMinutes = fallbackResult.estimatedMinutes;
          knowledgeGaps = fallbackResult.knowledgeGaps;
          totalAnalyzedNotes = fallbackResult.totalAnalyzedNotes;
          levels = fallbackResult.levels;
          if (fallbackResult.warnings) warnings.push(...fallbackResult.warnings);
        }
      } else {
        // Fallback: Link-based analysis
        console.log('[LearningPath] ✗ Using FALLBACK link-based algorithm');
        if (!useLLM) {
          console.log('[LearningPath] Reason: LLM not available');
          warnings.push('LLM analysis disabled, performing link-based analysis.');
        }
        if (!useSemanticSearch) {
          console.log('[LearningPath] Reason: PKM Note Recommender not available');
          warnings.push('PKM Note Recommender not available, performing link-based analysis.');
        }

        const fallbackResult = await this.executeFallback(goalNote, allNotes, noteMap, useLLM);
        sortedNodeIds = fallbackResult.sortedNodeIds;
        estimatedMinutes = fallbackResult.estimatedMinutes;
        knowledgeGaps = fallbackResult.knowledgeGaps;
        totalAnalyzedNotes = fallbackResult.totalAnalyzedNotes;
        levels = fallbackResult.levels;
        if (fallbackResult.warnings) warnings.push(...fallbackResult.warnings);
      }

      // 4. Create LearningNodes
      const learningNodes: LearningNode[] = sortedNodeIds
        .map((id, index) => {
          const note = noteMap.get(id);
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

      // 5. Create LearningPath
      const goalNoteTitle = request.name || goalNote.basename || goalNoteId;
      const path = LearningPath.create({
        id: this.generateId(),
        goalNoteId,
        goalNoteTitle,
        nodes: learningNodes,
        knowledgeGaps,
        totalAnalyzedNotes,
      });

      // 6. Save path
      await this.pathRepository.save(path);

      return {
        success: true,
        path: path.toData(),
        nodes: learningNodes.map((n) => n.toData()),
        levels,
        warnings: warnings.length > 0 ? warnings : undefined,
        knowledgeGaps: knowledgeGaps.length > 0 ? knowledgeGaps : undefined,
        totalAnalyzedNotes,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * New algorithm: LLM concept extraction + semantic search
   */
  private async executeWithSemanticSearch(
    goalNote: NoteData,
    allNotes: NoteData[],
    noteMap: Map<string, NoteData>
  ): Promise<{
    success: boolean;
    sortedNodeIds: string[];
    estimatedMinutes: Record<string, number>;
    knowledgeGaps: KnowledgeGapItem[];
    totalAnalyzedNotes: number;
    error?: string;
  }> {
    if (!this.aiService || !this.semanticSearchService) {
      return {
        success: false,
        sortedNodeIds: [],
        estimatedMinutes: {},
        knowledgeGaps: [],
        totalAnalyzedNotes: 0,
        error: 'Required services not available',
      };
    }

    // 1. Extract prerequisite concepts using LLM
    console.log('[LearningPath] Extracting prerequisite concepts...');
    const extractionResult = await this.aiService.extractPrerequisiteConcepts({
      title: goalNote.basename,
      content: goalNote.content,
    });

    if (!extractionResult.success || !extractionResult.data) {
      return {
        success: false,
        sortedNodeIds: [],
        estimatedMinutes: {},
        knowledgeGaps: [],
        totalAnalyzedNotes: 0,
        error: extractionResult.error || 'Concept extraction failed',
      };
    }

    const concepts = extractionResult.data;
    console.log(`[LearningPath] Extracted ${concepts.prerequisites.length} concepts, ${concepts.keywords.length} keywords`);

    // 2. Perform semantic search for each concept
    const searchQueries = [
      ...concepts.prerequisites.map((p) => p.concept),
      ...concepts.keywords.slice(0, 5), // Top 5 keywords only
    ];

    const foundNotes = new Map<string, NoteData>();
    const conceptNoteMapping = new Map<string, string[]>(); // concept -> noteIds

    for (const query of searchQueries) {
      console.log(`[LearningPath] Searching for concept: "${query}"`);
      const searchResults = await this.semanticSearchService.findSimilarToContent(query, {
        limit: 5,
        threshold: 0.3,  // Lowered from 0.5 for short concept strings
        excludeNoteIds: [goalNote.id],
      });
      console.log(`[LearningPath] Results for "${query}": ${searchResults.length} notes found`);

      const matchedNoteIds: string[] = [];
      for (const result of searchResults) {
        const note = noteMap.get(result.noteId);
        if (note && !foundNotes.has(result.noteId)) {
          foundNotes.set(result.noteId, note);
          matchedNoteIds.push(result.noteId);
        }
      }
      conceptNoteMapping.set(query, matchedNoteIds);
    }

    console.log(`[LearningPath] Found ${foundNotes.size} unique related notes`);

    // 3. Identify knowledge gaps: concepts with no matching notes
    const knowledgeGaps: KnowledgeGapItem[] = [];
    for (const prereq of concepts.prerequisites) {
      const matchedNotes = conceptNoteMapping.get(prereq.concept) || [];
      if (matchedNotes.length === 0) {
        knowledgeGaps.push({
          concept: prereq.concept,
          reason: prereq.description,
          priority: prereq.importance === 'essential' ? 'high' :
                   prereq.importance === 'helpful' ? 'medium' : 'low',
          suggestedResources: [`Search for "${prereq.concept}" resources`, `${prereq.concept} introduction`],
        });
      }
    }

    // 4. Fail if no notes found
    if (foundNotes.size === 0) {
      return {
        success: false,
        sortedNodeIds: [],
        estimatedMinutes: {},
        knowledgeGaps,
        totalAnalyzedNotes: 0,
        error: 'No related notes found.',
      };
    }

    // 5. Determine learning order using LLM
    const relatedNotes = Array.from(foundNotes.values()).map((n) => ({
      title: n.basename,
      content: n.content,
    }));

    const analysisResult = await this.aiService.analyzeNotesForLearningPath(
      { title: goalNote.basename, content: goalNote.content },
      relatedNotes
    );

    if (!analysisResult.success || !analysisResult.data) {
      // Fallback: 단순히 발견된 노트들 + 목표 노트
      const sortedNodeIds = [...foundNotes.keys(), goalNote.id];
      return {
        success: true,
        sortedNodeIds,
        estimatedMinutes: {},
        knowledgeGaps,
        totalAnalyzedNotes: foundNotes.size + 1,
      };
    }

    // 6. Combine results
    // Convert learningOrder to actual existing note IDs
    const titleToId = new Map<string, string>();
    for (const [id, note] of noteMap) {
      titleToId.set(note.basename, id);
    }
    titleToId.set(goalNote.basename, goalNote.id);

    const sortedNodeIds = analysisResult.data.learningOrder
      .map((title) => titleToId.get(title))
      .filter((id): id is string => id !== undefined);

    // Add goal note if not present
    if (!sortedNodeIds.includes(goalNote.id)) {
      sortedNodeIds.push(goalNote.id);
    }

    // Merge additional knowledge gaps identified by LLM
    const llmGaps = analysisResult.data.knowledgeGaps || [];
    for (const llmGap of llmGaps) {
      // Skip already existing gaps
      if (!knowledgeGaps.find((g) => g.concept === llmGap.concept)) {
        knowledgeGaps.push(llmGap);
      }
    }

    return {
      success: true,
      sortedNodeIds,
      estimatedMinutes: analysisResult.data.estimatedMinutes || {},
      knowledgeGaps,
      totalAnalyzedNotes: foundNotes.size + 1,
    };
  }

  /**
   * Fallback: Legacy link-based algorithm
   */
  private async executeFallback(
    goalNote: NoteData,
    allNotes: NoteData[],
    noteMap: Map<string, NoteData>,
    useLLM: boolean
  ): Promise<{
    sortedNodeIds: string[];
    estimatedMinutes: Record<string, number>;
    knowledgeGaps: KnowledgeGapItem[];
    totalAnalyzedNotes: number;
    levels: string[][];
    warnings?: string[];
  }> {
    const warnings: string[] = [];

    // Find related notes using link structure
    const targetNoteIds = this.findPathToGoal(allNotes, goalNote.id);
    const targetNotes = targetNoteIds
      .map((id) => noteMap.get(id))
      .filter((n): n is NoteData => n !== undefined);

    let sortedNodeIds: string[];
    let levels: string[][] = [];
    let estimatedMinutes: Record<string, number> = {};
    let knowledgeGaps: KnowledgeGapItem[] = [];

    if (useLLM && this.aiService?.isAvailable()) {
      const llmResult = await this.analyzewithLLM(goalNote, targetNotes);
      if (llmResult.success) {
        sortedNodeIds = llmResult.learningOrder;
        estimatedMinutes = llmResult.estimatedMinutes;
        knowledgeGaps = llmResult.knowledgeGaps;
        levels = [sortedNodeIds];
      } else {
        warnings.push(`LLM analysis failed: ${llmResult.error}`);
        const linkResult = this.analyzeWithLinks(targetNoteIds, allNotes);
        sortedNodeIds = linkResult.sortedIds;
        levels = linkResult.levels;
        if (linkResult.hasCycle) {
          warnings.push('Circular dependency detected. Some ordering may be arbitrary.');
        }
      }
    } else {
      const linkResult = this.analyzeWithLinks(targetNoteIds, allNotes);
      sortedNodeIds = linkResult.sortedIds;
      levels = linkResult.levels;
      if (linkResult.hasCycle) {
        warnings.push('Circular dependency detected. Some ordering may be arbitrary.');
      }
    }

    return {
      sortedNodeIds,
      estimatedMinutes,
      knowledgeGaps,
      totalAnalyzedNotes: targetNotes.length,
      levels,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Learning path analysis using LLM
   */
  private async analyzewithLLM(
    goalNote: NoteData,
    targetNotes: NoteData[]
  ): Promise<{
    success: boolean;
    learningOrder: string[];
    estimatedMinutes: Record<string, number>;
    knowledgeGaps: KnowledgeGapItem[];
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
   * Link-based learning path analysis (fallback)
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
   * Expand by traversing connected notes from start notes
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
   * Find prerequisites for the goal note
   *
   * Algorithm: Recursively traverse notes linked by the goal note
   * A → B link = "A references B" = "Need to know B first to understand A"
   * Therefore, follow forward links to find prerequisites
   *
   * @param maxDepth - Maximum traversal depth (default: 5, wide search for knowledge gap analysis)
   */
  private findPathToGoal(
    notes: NoteData[],
    goalId: string,
    maxDepth: number = 5
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

    while (queue.length > 0) {
      const { id: current, depth } = queue.shift()!;

      if (prerequisites.has(current) && current !== goalId) continue;
      prerequisites.add(current);

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

    return Array.from(prerequisites);
  }

  /**
   * Extract dependencies from note link structure
   *
   * A -> B link means "proceed to B after learning A"
   * In other words, A is prerequisite for B
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
   * Fallback sorting when circular dependency exists
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
   * Generate unique ID
   */
  private generateId(): string {
    return `path-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
