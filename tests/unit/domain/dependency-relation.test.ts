/**
 * DependencyRelation Value Object Tests
 * 노트 간 의존 관계 테스트
 */

import {
  DependencyRelation,
  DependencyType,
} from '../../../src/core/domain/value-objects/dependency-relation';

describe('DependencyRelation', () => {
  describe('creation', () => {
    it('should create prerequisite relation', () => {
      const relation = DependencyRelation.prerequisite('note-a', 'note-b');
      expect(relation.sourceId).toBe('note-a');
      expect(relation.targetId).toBe('note-b');
      expect(relation.type).toBe(DependencyType.PREREQUISITE);
      expect(relation.isPrerequisite()).toBe(true);
    });

    it('should create related relation', () => {
      const relation = DependencyRelation.related('note-a', 'note-b');
      expect(relation.type).toBe(DependencyType.RELATED);
      expect(relation.isRelated()).toBe(true);
    });

    it('should create optional relation', () => {
      const relation = DependencyRelation.optional('note-a', 'note-b');
      expect(relation.type).toBe(DependencyType.OPTIONAL);
      expect(relation.isOptional()).toBe(true);
    });

    it('should create with confidence score', () => {
      const relation = DependencyRelation.prerequisite('note-a', 'note-b', 0.85);
      expect(relation.confidence).toBe(0.85);
    });

    it('should default confidence to 1.0', () => {
      const relation = DependencyRelation.prerequisite('note-a', 'note-b');
      expect(relation.confidence).toBe(1.0);
    });

    it('should clamp confidence between 0 and 1', () => {
      const relation1 = DependencyRelation.prerequisite('a', 'b', 1.5);
      expect(relation1.confidence).toBe(1.0);

      const relation2 = DependencyRelation.prerequisite('a', 'b', -0.5);
      expect(relation2.confidence).toBe(0);
    });
  });

  describe('validation', () => {
    it('should throw error for self-reference', () => {
      expect(() => {
        DependencyRelation.prerequisite('note-a', 'note-a');
      }).toThrow('Self-reference dependency is not allowed');
    });

    it('should throw error for empty source', () => {
      expect(() => {
        DependencyRelation.prerequisite('', 'note-b');
      }).toThrow('Source and target IDs must not be empty');
    });

    it('should throw error for empty target', () => {
      expect(() => {
        DependencyRelation.prerequisite('note-a', '');
      }).toThrow('Source and target IDs must not be empty');
    });
  });

  describe('comparison', () => {
    it('should be equal when same source, target, and type', () => {
      const relation1 = DependencyRelation.prerequisite('note-a', 'note-b');
      const relation2 = DependencyRelation.prerequisite('note-a', 'note-b');
      expect(relation1.equals(relation2)).toBe(true);
    });

    it('should not be equal when different source', () => {
      const relation1 = DependencyRelation.prerequisite('note-a', 'note-b');
      const relation2 = DependencyRelation.prerequisite('note-c', 'note-b');
      expect(relation1.equals(relation2)).toBe(false);
    });

    it('should not be equal when different type', () => {
      const relation1 = DependencyRelation.prerequisite('note-a', 'note-b');
      const relation2 = DependencyRelation.related('note-a', 'note-b');
      expect(relation1.equals(relation2)).toBe(false);
    });

    it('should be equal regardless of confidence', () => {
      const relation1 = DependencyRelation.prerequisite('note-a', 'note-b', 0.5);
      const relation2 = DependencyRelation.prerequisite('note-a', 'note-b', 0.9);
      expect(relation1.equals(relation2)).toBe(true);
    });
  });

  describe('inversion', () => {
    it('should create inverse relation', () => {
      const relation = DependencyRelation.prerequisite('note-a', 'note-b', 0.8);
      const inverse = relation.inverse();

      expect(inverse.sourceId).toBe('note-b');
      expect(inverse.targetId).toBe('note-a');
      expect(inverse.type).toBe(DependencyType.PREREQUISITE);
      expect(inverse.confidence).toBe(0.8);
    });
  });

  describe('serialization', () => {
    it('should serialize to object', () => {
      const relation = DependencyRelation.prerequisite('note-a', 'note-b', 0.9);
      const obj = relation.toObject();

      expect(obj).toEqual({
        sourceId: 'note-a',
        targetId: 'note-b',
        type: 'prerequisite',
        confidence: 0.9,
      });
    });

    it('should deserialize from object', () => {
      const obj = {
        sourceId: 'note-a',
        targetId: 'note-b',
        type: 'prerequisite',
        confidence: 0.9,
      };
      const relation = DependencyRelation.fromObject(obj);

      expect(relation.sourceId).toBe('note-a');
      expect(relation.targetId).toBe('note-b');
      expect(relation.type).toBe(DependencyType.PREREQUISITE);
      expect(relation.confidence).toBe(0.9);
    });

    it('should convert to display string', () => {
      const relation = DependencyRelation.prerequisite('note-a', 'note-b');
      expect(relation.toDisplayString()).toBe('note-a → note-b (선행)');
    });
  });
});
