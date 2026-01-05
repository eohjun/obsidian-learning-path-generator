/**
 * DependencyAnalyzer Domain Service Tests
 * 의존성 분석 및 위상 정렬 알고리즘 테스트
 */

import { DependencyAnalyzer, DependencyGraph } from '../../../src/core/domain/services/dependency-analyzer';
import { DependencyRelation } from '../../../src/core/domain/value-objects/dependency-relation';

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer();
  });

  describe('buildGraph', () => {
    it('should build empty graph with no nodes', () => {
      const graph = analyzer.buildGraph([]);
      expect(graph.nodes.size).toBe(0);
      expect(graph.edges.size).toBe(0);
    });

    it('should build graph from single node', () => {
      const graph = analyzer.buildGraph(['a']);
      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.has('a')).toBe(true);
    });

    it('should build graph from multiple nodes', () => {
      const graph = analyzer.buildGraph(['a', 'b', 'c']);
      expect(graph.nodes.size).toBe(3);
    });

    it('should add edges from dependencies', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'), // a is prerequisite for b
        DependencyRelation.prerequisite('b', 'c'), // b is prerequisite for c
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c'], dependencies);

      // Edge direction: prerequisite -> dependent (a -> b means learn a before b)
      expect(graph.edges.get('a')).toContain('b');
      expect(graph.edges.get('b')).toContain('c');
    });

    it('should ignore non-prerequisite dependencies', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.related('b', 'c'), // related, not prerequisite
        DependencyRelation.optional('c', 'd'), // optional, not prerequisite
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c', 'd'], dependencies);

      expect(graph.edges.get('a')).toContain('b');
      expect(graph.edges.get('b')).not.toContain('c');
      expect(graph.edges.get('c')).not.toContain('d');
    });
  });

  describe('topologicalSort', () => {
    it('should return empty array for empty graph', () => {
      const graph = analyzer.buildGraph([]);
      const sorted = analyzer.topologicalSort(graph);
      expect(sorted).toEqual([]);
    });

    it('should return single node for single-node graph', () => {
      const graph = analyzer.buildGraph(['a']);
      const sorted = analyzer.topologicalSort(graph);
      expect(sorted).toEqual(['a']);
    });

    it('should return nodes in dependency order (linear chain)', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('b', 'c'),
        DependencyRelation.prerequisite('c', 'd'),
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c', 'd'], dependencies);
      const sorted = analyzer.topologicalSort(graph);

      // a should come before b, b before c, c before d
      expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
      expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'));
      expect(sorted.indexOf('c')).toBeLessThan(sorted.indexOf('d'));
    });

    it('should handle multiple independent chains', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('c', 'd'),
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c', 'd'], dependencies);
      const sorted = analyzer.topologicalSort(graph);

      // a before b, c before d (order between chains doesn't matter)
      expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
      expect(sorted.indexOf('c')).toBeLessThan(sorted.indexOf('d'));
    });

    it('should handle diamond dependency', () => {
      //     a
      //    / \
      //   b   c
      //    \ /
      //     d
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('a', 'c'),
        DependencyRelation.prerequisite('b', 'd'),
        DependencyRelation.prerequisite('c', 'd'),
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c', 'd'], dependencies);
      const sorted = analyzer.topologicalSort(graph);

      // a must come first, d must come last
      expect(sorted[0]).toBe('a');
      expect(sorted[sorted.length - 1]).toBe('d');
      // b and c must come before d
      expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('d'));
      expect(sorted.indexOf('c')).toBeLessThan(sorted.indexOf('d'));
    });

    it('should throw error for cyclic graph', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('b', 'c'),
        DependencyRelation.prerequisite('c', 'a'), // cycle!
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c'], dependencies);

      expect(() => analyzer.topologicalSort(graph)).toThrow('Circular dependency detected');
    });

    it('should throw error for self-loop', () => {
      // Self-loop is already prevented by DependencyRelation, but test graph directly
      const graph: DependencyGraph = {
        nodes: new Set(['a']),
        edges: new Map([['a', ['a']]]), // self-loop
      };

      expect(() => analyzer.topologicalSort(graph)).toThrow('Circular dependency detected');
    });
  });

  describe('detectCycle', () => {
    it('should return false for acyclic graph', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('b', 'c'),
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c'], dependencies);
      expect(analyzer.detectCycle(graph)).toBe(false);
    });

    it('should return true for cyclic graph', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('b', 'a'),
      ];

      const graph = analyzer.buildGraph(['a', 'b'], dependencies);
      expect(analyzer.detectCycle(graph)).toBe(true);
    });

    it('should return true for complex cycle', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('b', 'c'),
        DependencyRelation.prerequisite('c', 'd'),
        DependencyRelation.prerequisite('d', 'b'), // cycle: b -> c -> d -> b
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c', 'd'], dependencies);
      expect(analyzer.detectCycle(graph)).toBe(true);
    });

    it('should return false for empty graph', () => {
      const graph = analyzer.buildGraph([]);
      expect(analyzer.detectCycle(graph)).toBe(false);
    });
  });

  describe('getAncestors', () => {
    it('should return empty set for node with no dependencies', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
      ];

      const graph = analyzer.buildGraph(['a', 'b'], dependencies);
      const ancestors = analyzer.getAncestors(graph, 'a');

      expect(ancestors.size).toBe(0);
    });

    it('should return direct prerequisites', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'c'),
        DependencyRelation.prerequisite('b', 'c'),
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c'], dependencies);
      const ancestors = analyzer.getAncestors(graph, 'c');

      expect(ancestors.has('a')).toBe(true);
      expect(ancestors.has('b')).toBe(true);
    });

    it('should return transitive prerequisites', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('b', 'c'),
        DependencyRelation.prerequisite('c', 'd'),
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c', 'd'], dependencies);
      const ancestors = analyzer.getAncestors(graph, 'd');

      expect(ancestors.has('a')).toBe(true);
      expect(ancestors.has('b')).toBe(true);
      expect(ancestors.has('c')).toBe(true);
    });
  });

  describe('getDescendants', () => {
    it('should return empty set for node with no dependents', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
      ];

      const graph = analyzer.buildGraph(['a', 'b'], dependencies);
      const descendants = analyzer.getDescendants(graph, 'b');

      expect(descendants.size).toBe(0);
    });

    it('should return direct dependents', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('a', 'c'),
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c'], dependencies);
      const descendants = analyzer.getDescendants(graph, 'a');

      expect(descendants.has('b')).toBe(true);
      expect(descendants.has('c')).toBe(true);
    });

    it('should return transitive dependents', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('b', 'c'),
        DependencyRelation.prerequisite('c', 'd'),
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c', 'd'], dependencies);
      const descendants = analyzer.getDescendants(graph, 'a');

      expect(descendants.has('b')).toBe(true);
      expect(descendants.has('c')).toBe(true);
      expect(descendants.has('d')).toBe(true);
    });
  });

  describe('findPathToGoal', () => {
    it('should return single node path for goal with no prerequisites', () => {
      const dependencies: DependencyRelation[] = [];

      const graph = analyzer.buildGraph(['a'], dependencies);
      const path = analyzer.findPathToGoal(graph, 'a');

      expect(path).toEqual(['a']);
    });

    it('should return path including all prerequisites', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('b', 'c'),
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c'], dependencies);
      const path = analyzer.findPathToGoal(graph, 'c');

      expect(path).toEqual(['a', 'b', 'c']);
    });

    it('should not include unrelated nodes', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('c', 'd'), // unrelated chain
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c', 'd'], dependencies);
      const path = analyzer.findPathToGoal(graph, 'b');

      expect(path).toEqual(['a', 'b']);
      expect(path).not.toContain('c');
      expect(path).not.toContain('d');
    });

    it('should handle diamond dependency in path', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('a', 'c'),
        DependencyRelation.prerequisite('b', 'd'),
        DependencyRelation.prerequisite('c', 'd'),
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c', 'd'], dependencies);
      const path = analyzer.findPathToGoal(graph, 'd');

      // Should include all prerequisites, goal last
      expect(path.length).toBe(4);
      expect(path[0]).toBe('a');
      expect(path[path.length - 1]).toBe('d');
      expect(path).toContain('b');
      expect(path).toContain('c');
    });

    it('should throw error for non-existent goal', () => {
      const graph = analyzer.buildGraph(['a', 'b'], []);

      expect(() => analyzer.findPathToGoal(graph, 'z')).toThrow('Goal node not found');
    });
  });

  describe('getLevels', () => {
    it('should return single level for independent nodes', () => {
      const graph = analyzer.buildGraph(['a', 'b', 'c'], []);
      const levels = analyzer.getLevels(graph);

      expect(levels.length).toBe(1);
      expect(levels[0].sort()).toEqual(['a', 'b', 'c']);
    });

    it('should return multiple levels for linear chain', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('b', 'c'),
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c'], dependencies);
      const levels = analyzer.getLevels(graph);

      expect(levels.length).toBe(3);
      expect(levels[0]).toEqual(['a']);
      expect(levels[1]).toEqual(['b']);
      expect(levels[2]).toEqual(['c']);
    });

    it('should group parallel nodes in same level', () => {
      const dependencies = [
        DependencyRelation.prerequisite('a', 'b'),
        DependencyRelation.prerequisite('a', 'c'),
        DependencyRelation.prerequisite('b', 'd'),
        DependencyRelation.prerequisite('c', 'd'),
      ];

      const graph = analyzer.buildGraph(['a', 'b', 'c', 'd'], dependencies);
      const levels = analyzer.getLevels(graph);

      expect(levels.length).toBe(3);
      expect(levels[0]).toEqual(['a']);
      expect(levels[1].sort()).toEqual(['b', 'c']);
      expect(levels[2]).toEqual(['d']);
    });
  });
});
