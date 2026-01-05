/**
 * LearningPath Entity Tests
 */

import { LearningPath } from '../../../src/core/domain/entities/learning-path';
import { LearningNode } from '../../../src/core/domain/entities/learning-node';
import { MasteryLevel } from '../../../src/core/domain/value-objects/mastery-level';
import { DependencyRelation } from '../../../src/core/domain/value-objects/dependency-relation';

describe('LearningPath', () => {
  const createTestNode = (id: string, title: string, order: number = 0) =>
    LearningNode.create({
      noteId: id,
      notePath: `notes/${id}.md`,
      title,
      order,
    });

  describe('creation', () => {
    it('should create empty learning path', () => {
      const path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal-note',
        goalNoteTitle: 'Master TypeScript',
      });

      expect(path.id).toBe('path-1');
      expect(path.goalNoteId).toBe('goal-note');
      expect(path.goalNoteTitle).toBe('Master TypeScript');
      expect(path.nodes).toHaveLength(0);
      expect(path.isEmpty()).toBe(true);
    });

    it('should create path with nodes', () => {
      const nodes = [
        createTestNode('node-1', 'Basics'),
        createTestNode('node-2', 'Advanced'),
      ];

      const path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal-note',
        goalNoteTitle: 'Goal',
        nodes,
      });

      expect(path.nodes).toHaveLength(2);
      expect(path.isEmpty()).toBe(false);
    });

    it('should throw error for missing id', () => {
      expect(() => {
        LearningPath.create({
          id: '',
          goalNoteId: 'goal',
          goalNoteTitle: 'Title',
        });
      }).toThrow('ID and goal note ID are required');
    });

    it('should generate unique id', () => {
      const id1 = LearningPath.generateId();
      const id2 = LearningPath.generateId();

      expect(id1).toMatch(/^path-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('node operations', () => {
    it('should add node with auto-assigned order', () => {
      const path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal',
        goalNoteTitle: 'Goal',
      });

      const node = createTestNode('node-1', 'First');
      const updatedPath = path.addNode(node);

      expect(updatedPath.nodes).toHaveLength(1);
      expect(updatedPath.nodes[0].order).toBe(1);
    });

    it('should add multiple nodes in order', () => {
      let path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal',
        goalNoteTitle: 'Goal',
      });

      path = path.addNode(createTestNode('node-1', 'First'));
      path = path.addNode(createTestNode('node-2', 'Second'));
      path = path.addNode(createTestNode('node-3', 'Third'));

      expect(path.nodes).toHaveLength(3);
      expect(path.nodes[0].order).toBe(1);
      expect(path.nodes[1].order).toBe(2);
      expect(path.nodes[2].order).toBe(3);
    });

    it('should update existing node when adding duplicate', () => {
      let path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal',
        goalNoteTitle: 'Goal',
      });

      path = path.addNode(createTestNode('node-1', 'First'));
      path = path.addNode(createTestNode('node-1', 'Updated First'));

      expect(path.nodes).toHaveLength(1);
      expect(path.nodes[0].title).toBe('Updated First');
    });

    it('should remove node and reorder', () => {
      let path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal',
        goalNoteTitle: 'Goal',
      });

      path = path.addNode(createTestNode('node-1', 'First'));
      path = path.addNode(createTestNode('node-2', 'Second'));
      path = path.addNode(createTestNode('node-3', 'Third'));

      path = path.removeNode('node-2');

      expect(path.nodes).toHaveLength(2);
      expect(path.nodes[0].noteId).toBe('node-1');
      expect(path.nodes[0].order).toBe(1);
      expect(path.nodes[1].noteId).toBe('node-3');
      expect(path.nodes[1].order).toBe(2);
    });

    it('should set nodes with proper ordering', () => {
      const path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal',
        goalNoteTitle: 'Goal',
      });

      const nodes = [
        createTestNode('node-a', 'A'),
        createTestNode('node-b', 'B'),
        createTestNode('node-c', 'C'),
      ];

      const updatedPath = path.setNodes(nodes);

      expect(updatedPath.nodes[0].order).toBe(1);
      expect(updatedPath.nodes[1].order).toBe(2);
      expect(updatedPath.nodes[2].order).toBe(3);
    });
  });

  describe('progress tracking', () => {
    let path: LearningPath;

    beforeEach(() => {
      path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal',
        goalNoteTitle: 'Goal',
      });
      path = path.addNode(createTestNode('node-1', 'First'));
      path = path.addNode(createTestNode('node-2', 'Second'));
      path = path.addNode(createTestNode('node-3', 'Third'));
    });

    it('should mark node as completed', () => {
      path = path.markNodeCompleted('node-1');

      expect(path.getNode('node-1')?.isCompleted()).toBe(true);
      expect(path.getCompletedNodes()).toHaveLength(1);
    });

    it('should mark node as in progress', () => {
      path = path.markNodeInProgress('node-1');

      expect(path.getNode('node-1')?.isInProgress()).toBe(true);
      expect(path.getInProgressNodes()).toHaveLength(1);
    });

    it('should reset node progress', () => {
      path = path.markNodeCompleted('node-1');
      path = path.resetNode('node-1');

      expect(path.getNode('node-1')?.isNotStarted()).toBe(true);
    });

    it('should reset all progress', () => {
      path = path.markNodeCompleted('node-1');
      path = path.markNodeCompleted('node-2');
      path = path.markNodeInProgress('node-3');

      path = path.resetAllProgress();

      expect(path.getCompletedNodes()).toHaveLength(0);
      expect(path.getInProgressNodes()).toHaveLength(0);
      expect(path.getNotStartedNodes()).toHaveLength(3);
    });

    it('should get current node (first incomplete)', () => {
      path = path.markNodeCompleted('node-1');

      const current = path.getCurrentNode();
      expect(current?.noteId).toBe('node-2');
    });

    it('should calculate statistics', () => {
      path = path.markNodeCompleted('node-1');
      path = path.markNodeInProgress('node-2');

      const stats = path.getStatistics();

      expect(stats.totalNodes).toBe(3);
      expect(stats.completedNodes).toBe(1);
      expect(stats.inProgressNodes).toBe(1);
      expect(stats.notStartedNodes).toBe(1);
      expect(stats.progressPercent()).toBe(33);
    });

    it('should detect completion', () => {
      expect(path.isCompleted()).toBe(false);

      path = path.markNodeCompleted('node-1');
      path = path.markNodeCompleted('node-2');
      path = path.markNodeCompleted('node-3');

      expect(path.isCompleted()).toBe(true);
    });
  });

  describe('query methods', () => {
    it('should get node by id', () => {
      let path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal',
        goalNoteTitle: 'Goal',
      });
      path = path.addNode(createTestNode('node-1', 'First'));

      expect(path.getNode('node-1')?.title).toBe('First');
      expect(path.getNode('non-existent')).toBeUndefined();
    });

    it('should get node by order', () => {
      let path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal',
        goalNoteTitle: 'Goal',
      });
      path = path.addNode(createTestNode('node-1', 'First'));
      path = path.addNode(createTestNode('node-2', 'Second'));

      expect(path.getNodeByOrder(1)?.noteId).toBe('node-1');
      expect(path.getNodeByOrder(2)?.noteId).toBe('node-2');
    });
  });

  describe('serialization', () => {
    it('should serialize to data', () => {
      let path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal',
        goalNoteTitle: 'Goal',
      });
      path = path.addNode(createTestNode('node-1', 'First'));

      const data = path.toData();

      expect(data.id).toBe('path-1');
      expect(data.goalNoteId).toBe('goal');
      expect(data.nodes).toHaveLength(1);
      expect(data.createdAt).toBeDefined();
    });

    it('should deserialize from data', () => {
      const data = {
        id: 'path-1',
        goalNoteId: 'goal',
        goalNoteTitle: 'Goal',
        nodes: [
          {
            noteId: 'node-1',
            notePath: 'notes/node-1.md',
            title: 'First',
            order: 1,
            masteryLevel: 'completed',
            dependencies: [],
          },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const path = LearningPath.fromData(data);

      expect(path.id).toBe('path-1');
      expect(path.nodes).toHaveLength(1);
      expect(path.nodes[0].isCompleted()).toBe(true);
    });
  });

  describe('circular dependency detection', () => {
    it('should detect no circular dependency in valid path', () => {
      let path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal',
        goalNoteTitle: 'Goal',
      });

      const nodeA = LearningNode.create({
        noteId: 'a',
        notePath: 'a.md',
        title: 'A',
      });

      const nodeB = LearningNode.create({
        noteId: 'b',
        notePath: 'b.md',
        title: 'B',
        dependencies: [DependencyRelation.prerequisite('a', 'b')],
      });

      path = path.addNode(nodeA);
      path = path.addNode(nodeB);

      expect(path.hasCircularDependency()).toBe(false);
    });

    it('should detect circular dependency', () => {
      let path = LearningPath.create({
        id: 'path-1',
        goalNoteId: 'goal',
        goalNoteTitle: 'Goal',
      });

      const nodeA = LearningNode.create({
        noteId: 'a',
        notePath: 'a.md',
        title: 'A',
        dependencies: [DependencyRelation.prerequisite('b', 'a')],
      });

      const nodeB = LearningNode.create({
        noteId: 'b',
        notePath: 'b.md',
        title: 'B',
        dependencies: [DependencyRelation.prerequisite('a', 'b')],
      });

      path = path.addNode(nodeA);
      path = path.addNode(nodeB);

      expect(path.hasCircularDependency()).toBe(true);
    });
  });
});
