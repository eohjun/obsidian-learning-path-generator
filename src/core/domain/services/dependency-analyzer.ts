/**
 * DependencyAnalyzer Domain Service
 *
 * Domain service that analyzes dependencies between notes and determines learning order
 *
 * Algorithms:
 * - DAG (Directed Acyclic Graph) construction
 * - Topological sort using Kahn's Algorithm
 * - DFS-based cycle detection
 */

import { DependencyRelation } from '../value-objects/dependency-relation';

export interface DependencyGraph {
  /**
   * All nodes in the graph (note IDs)
   */
  nodes: Set<string>;

  /**
   * Adjacency list (source -> targets)
   * If edge exists: source must be learned before target
   */
  edges: Map<string, string[]>;
}

export class DependencyAnalyzer {
  /**
   * Build graph from nodes and dependencies
   *
   * @param nodeIds List of node IDs
   * @param dependencies List of dependency relations
   * @returns Dependency graph
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
   * Topological sort (Kahn's Algorithm)
   * Sort so that prerequisite nodes come first
   *
   * @param graph Dependency graph
   * @returns Sorted array of node IDs
   * @throws Error if circular dependency exists
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
   * Detect circular dependency (DFS-based)
   *
   * @param graph Dependency graph
   * @returns true if cycle exists
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
   * Find all ancestor nodes (predecessors) of a specific node
   *
   * @param graph Dependency graph
   * @param nodeId Target node
   * @returns Set of ancestor nodes
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
   * Find all descendant nodes (successors) of a specific node
   *
   * @param graph Dependency graph
   * @param nodeId Target node
   * @returns Set of descendant nodes
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
   * Find learning path to goal node
   * Includes all prerequisite nodes needed to achieve the goal
   *
   * @param graph Dependency graph
   * @param goalId Goal node ID
   * @returns Array of node IDs sorted in learning order
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
   * Group nodes by level
   * Nodes at the same level can be learned in parallel
   *
   * @param graph Dependency graph
   * @returns Array of nodes per level
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
