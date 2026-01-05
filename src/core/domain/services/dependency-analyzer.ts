/**
 * DependencyAnalyzer Domain Service
 *
 * 노트 간 의존성을 분석하고 학습 순서를 결정하는 도메인 서비스
 *
 * 알고리즘:
 * - DAG(Directed Acyclic Graph) 구성
 * - Kahn's Algorithm을 사용한 위상 정렬
 * - DFS 기반 순환 탐지
 */

import { DependencyRelation } from '../value-objects/dependency-relation';

export interface DependencyGraph {
  /**
   * 그래프의 모든 노드 (노트 ID)
   */
  nodes: Set<string>;

  /**
   * 인접 리스트 (source -> targets)
   * edge가 있으면: source를 먼저 학습해야 target 학습 가능
   */
  edges: Map<string, string[]>;
}

export class DependencyAnalyzer {
  /**
   * 노드와 의존관계로부터 그래프 구성
   *
   * @param nodeIds 노드 ID 목록
   * @param dependencies 의존 관계 목록
   * @returns 의존성 그래프
   */
  buildGraph(
    nodeIds: string[],
    dependencies: DependencyRelation[] = []
  ): DependencyGraph {
    const nodes = new Set(nodeIds);
    const edges = new Map<string, string[]>();

    // Initialize adjacency list
    for (const nodeId of nodeIds) {
      edges.set(nodeId, []);
    }

    // Add edges from prerequisite dependencies only
    for (const dep of dependencies) {
      if (dep.isPrerequisite()) {
        // source is prerequisite for target
        // So we add edge: source -> target (learn source first)
        if (nodes.has(dep.sourceId) && nodes.has(dep.targetId)) {
          const adj = edges.get(dep.sourceId);
          if (adj && !adj.includes(dep.targetId)) {
            adj.push(dep.targetId);
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * 위상 정렬 (Kahn's Algorithm)
   * 선행 노드가 먼저 오도록 정렬
   *
   * @param graph 의존성 그래프
   * @returns 정렬된 노드 ID 배열
   * @throws 순환 의존성이 있으면 에러
   */
  topologicalSort(graph: DependencyGraph): string[] {
    if (graph.nodes.size === 0) {
      return [];
    }

    // Calculate in-degree for each node
    const inDegree = new Map<string, number>();
    for (const node of graph.nodes) {
      inDegree.set(node, 0);
    }

    for (const [, neighbors] of graph.edges) {
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) + 1);
      }
    }

    // Queue of nodes with no incoming edges
    const queue: string[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    const result: string[] = [];

    while (queue.length > 0) {
      // Sort queue for deterministic order
      queue.sort();
      const current = queue.shift()!;
      result.push(current);

      const neighbors = graph.edges.get(current) ?? [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // If not all nodes are in result, there's a cycle
    if (result.length !== graph.nodes.size) {
      throw new Error('Circular dependency detected');
    }

    return result;
  }

  /**
   * 순환 의존성 탐지 (DFS 기반)
   *
   * @param graph 의존성 그래프
   * @returns 순환이 있으면 true
   */
  detectCycle(graph: DependencyGraph): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      const neighbors = graph.edges.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }

    return false;
  }

  /**
   * 특정 노드의 모든 선행 노드(조상) 찾기
   *
   * @param graph 의존성 그래프
   * @param nodeId 대상 노드
   * @returns 선행 노드들의 집합
   */
  getAncestors(graph: DependencyGraph, nodeId: string): Set<string> {
    const ancestors = new Set<string>();

    // Build reverse edges for efficient ancestor lookup
    const reverseEdges = new Map<string, string[]>();
    for (const node of graph.nodes) {
      reverseEdges.set(node, []);
    }

    for (const [source, targets] of graph.edges) {
      for (const target of targets) {
        reverseEdges.get(target)?.push(source);
      }
    }

    // BFS to find all ancestors
    const queue = [...(reverseEdges.get(nodeId) ?? [])];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!ancestors.has(current)) {
        ancestors.add(current);
        const parents = reverseEdges.get(current) ?? [];
        queue.push(...parents);
      }
    }

    return ancestors;
  }

  /**
   * 특정 노드의 모든 후행 노드(자손) 찾기
   *
   * @param graph 의존성 그래프
   * @param nodeId 대상 노드
   * @returns 후행 노드들의 집합
   */
  getDescendants(graph: DependencyGraph, nodeId: string): Set<string> {
    const descendants = new Set<string>();

    // BFS to find all descendants
    const queue = [...(graph.edges.get(nodeId) ?? [])];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!descendants.has(current)) {
        descendants.add(current);
        const children = graph.edges.get(current) ?? [];
        queue.push(...children);
      }
    }

    return descendants;
  }

  /**
   * 목표 노드까지의 학습 경로 찾기
   * 목표 달성에 필요한 모든 선행 노드를 포함
   *
   * @param graph 의존성 그래프
   * @param goalId 목표 노드 ID
   * @returns 학습 순서대로 정렬된 노드 ID 배열
   */
  findPathToGoal(graph: DependencyGraph, goalId: string): string[] {
    if (!graph.nodes.has(goalId)) {
      throw new Error('Goal node not found');
    }

    // Get all ancestors of goal
    const ancestors = this.getAncestors(graph, goalId);
    ancestors.add(goalId);

    // Build subgraph with only relevant nodes
    const subgraphNodes = Array.from(ancestors);
    const subgraphEdges = new Map<string, string[]>();

    for (const node of subgraphNodes) {
      const originalEdges = graph.edges.get(node) ?? [];
      const filteredEdges = originalEdges.filter((target) =>
        ancestors.has(target)
      );
      subgraphEdges.set(node, filteredEdges);
    }

    const subgraph: DependencyGraph = {
      nodes: new Set(subgraphNodes),
      edges: subgraphEdges,
    };

    // Topological sort the subgraph
    return this.topologicalSort(subgraph);
  }

  /**
   * 노드들을 레벨별로 그룹화
   * 같은 레벨의 노드들은 병렬 학습 가능
   *
   * @param graph 의존성 그래프
   * @returns 레벨별 노드 배열
   */
  getLevels(graph: DependencyGraph): string[][] {
    if (graph.nodes.size === 0) {
      return [];
    }

    // Calculate in-degree
    const inDegree = new Map<string, number>();
    for (const node of graph.nodes) {
      inDegree.set(node, 0);
    }

    for (const [, neighbors] of graph.edges) {
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) + 1);
      }
    }

    const levels: string[][] = [];
    const remaining = new Set(graph.nodes);

    while (remaining.size > 0) {
      // Find all nodes with in-degree 0
      const currentLevel: string[] = [];
      for (const node of remaining) {
        if ((inDegree.get(node) ?? 0) === 0) {
          currentLevel.push(node);
        }
      }

      if (currentLevel.length === 0) {
        // Cycle detected
        throw new Error('Circular dependency detected');
      }

      // Remove current level nodes and update in-degrees
      for (const node of currentLevel) {
        remaining.delete(node);
        const neighbors = graph.edges.get(node) ?? [];
        for (const neighbor of neighbors) {
          inDegree.set(neighbor, (inDegree.get(neighbor) ?? 1) - 1);
        }
      }

      levels.push(currentLevel.sort());
    }

    return levels;
  }
}
