/**
 * MasteryLevel Value Object Tests
 * 학습 숙달도 상태 및 전이 규칙 테스트
 */

import { MasteryLevel, MasteryLevelValue } from '../../../src/core/domain/value-objects/mastery-level';

describe('MasteryLevel', () => {
  describe('creation', () => {
    it('should create NOT_STARTED level by default', () => {
      const level = MasteryLevel.notStarted();
      expect(level.value).toBe(MasteryLevelValue.NOT_STARTED);
      expect(level.isNotStarted()).toBe(true);
    });

    it('should create IN_PROGRESS level', () => {
      const level = MasteryLevel.inProgress();
      expect(level.value).toBe(MasteryLevelValue.IN_PROGRESS);
      expect(level.isInProgress()).toBe(true);
    });

    it('should create COMPLETED level', () => {
      const level = MasteryLevel.completed();
      expect(level.value).toBe(MasteryLevelValue.COMPLETED);
      expect(level.isCompleted()).toBe(true);
    });

    it('should create from string value', () => {
      expect(MasteryLevel.fromString('not_started').value).toBe(MasteryLevelValue.NOT_STARTED);
      expect(MasteryLevel.fromString('in_progress').value).toBe(MasteryLevelValue.IN_PROGRESS);
      expect(MasteryLevel.fromString('completed').value).toBe(MasteryLevelValue.COMPLETED);
    });

    it('should default to NOT_STARTED for unknown string', () => {
      expect(MasteryLevel.fromString('unknown').value).toBe(MasteryLevelValue.NOT_STARTED);
      expect(MasteryLevel.fromString('').value).toBe(MasteryLevelValue.NOT_STARTED);
    });
  });

  describe('state transitions', () => {
    it('should transition from NOT_STARTED to IN_PROGRESS', () => {
      const level = MasteryLevel.notStarted();
      const next = level.startLearning();
      expect(next.value).toBe(MasteryLevelValue.IN_PROGRESS);
    });

    it('should transition from IN_PROGRESS to COMPLETED', () => {
      const level = MasteryLevel.inProgress();
      const next = level.complete();
      expect(next.value).toBe(MasteryLevelValue.COMPLETED);
    });

    it('should allow reset to NOT_STARTED', () => {
      const level = MasteryLevel.completed();
      const next = level.reset();
      expect(next.value).toBe(MasteryLevelValue.NOT_STARTED);
    });

    it('should not change COMPLETED when startLearning is called', () => {
      const level = MasteryLevel.completed();
      const next = level.startLearning();
      expect(next.value).toBe(MasteryLevelValue.COMPLETED);
    });

    it('should allow direct completion from NOT_STARTED', () => {
      const level = MasteryLevel.notStarted();
      const next = level.complete();
      expect(next.value).toBe(MasteryLevelValue.COMPLETED);
    });
  });

  describe('comparison', () => {
    it('should be equal when same value', () => {
      const level1 = MasteryLevel.inProgress();
      const level2 = MasteryLevel.inProgress();
      expect(level1.equals(level2)).toBe(true);
    });

    it('should not be equal when different value', () => {
      const level1 = MasteryLevel.notStarted();
      const level2 = MasteryLevel.completed();
      expect(level1.equals(level2)).toBe(false);
    });
  });

  describe('progress calculation', () => {
    it('should return 0% for NOT_STARTED', () => {
      const level = MasteryLevel.notStarted();
      expect(level.progressPercent()).toBe(0);
    });

    it('should return 50% for IN_PROGRESS', () => {
      const level = MasteryLevel.inProgress();
      expect(level.progressPercent()).toBe(50);
    });

    it('should return 100% for COMPLETED', () => {
      const level = MasteryLevel.completed();
      expect(level.progressPercent()).toBe(100);
    });
  });

  describe('serialization', () => {
    it('should serialize to string', () => {
      expect(MasteryLevel.notStarted().toString()).toBe('not_started');
      expect(MasteryLevel.inProgress().toString()).toBe('in_progress');
      expect(MasteryLevel.completed().toString()).toBe('completed');
    });

    it('should serialize to display label', () => {
      expect(MasteryLevel.notStarted().toDisplayLabel()).toBe('미학습');
      expect(MasteryLevel.inProgress().toDisplayLabel()).toBe('학습중');
      expect(MasteryLevel.completed().toDisplayLabel()).toBe('완료');
    });

    it('should serialize to icon', () => {
      expect(MasteryLevel.notStarted().toIcon()).toBe('⬜');
      expect(MasteryLevel.inProgress().toIcon()).toBe('🔄');
      expect(MasteryLevel.completed().toIcon()).toBe('✅');
    });
  });
});
