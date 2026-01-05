/**
 * UpdateProgressUseCase Tests
 * 학습 진행 상태 업데이트 유스케이스 테스트
 */

import { UpdateProgressUseCase } from '../../../src/core/application/use-cases/update-progress';
import {
  IPathRepository,
  IProgressRepository,
  LearningPath,
  LearningNode,
  MasteryLevel,
  MasteryLevelValue,
} from '../../../src/core/domain';
import { UpdateProgressRequest } from '../../../src/core/application/dtos';

describe('UpdateProgressUseCase', () => {
  let useCase: UpdateProgressUseCase;
  let mockPathRepository: jest.Mocked<IPathRepository>;
  let mockProgressRepository: jest.Mocked<IProgressRepository>;

  const createTestPath = (): LearningPath => {
    const nodes = [
      LearningNode.create({
        noteId: 'node-1',
        notePath: 'notes/node-1.md',
        title: 'Node 1',
        order: 1,
      }),
      LearningNode.create({
        noteId: 'node-2',
        notePath: 'notes/node-2.md',
        title: 'Node 2',
        order: 2,
      }),
      LearningNode.create({
        noteId: 'node-3',
        notePath: 'notes/node-3.md',
        title: 'Node 3',
        order: 3,
      }),
    ];

    return LearningPath.create({
      id: 'test-path',
      goalNoteId: 'node-3',
      goalNoteTitle: 'Test Learning Path',
      nodes,
    });
  };

  beforeEach(() => {
    mockPathRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByGoalNote: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    };

    mockProgressRepository = {
      getProgress: jest.fn(),
      updateProgress: jest.fn(),
      getLastStudied: jest.fn(),
      updateLastStudied: jest.fn(),
      incrementStudyCount: jest.fn(),
      getBulkProgress: jest.fn(),
      resetProgress: jest.fn(),
      resetAllProgress: jest.fn(),
    };

    useCase = new UpdateProgressUseCase(
      mockPathRepository,
      mockProgressRepository
    );
  });

  describe('execute', () => {
    it('should return error when path not found', async () => {
      mockPathRepository.findById.mockResolvedValue(null);

      const request: UpdateProgressRequest = {
        pathId: 'non-existent',
        nodeId: 'node-1',
        newLevel: MasteryLevelValue.IN_PROGRESS,
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('should return error when node not found in path', async () => {
      mockPathRepository.findById.mockResolvedValue(createTestPath());

      const request: UpdateProgressRequest = {
        pathId: 'test-path',
        nodeId: 'non-existent-node',
        newLevel: MasteryLevelValue.IN_PROGRESS,
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('should update node to in_progress', async () => {
      mockPathRepository.findById.mockResolvedValue(createTestPath());
      mockPathRepository.save.mockResolvedValue();
      mockProgressRepository.updateProgress.mockResolvedValue();
      mockProgressRepository.updateLastStudied.mockResolvedValue();

      const request: UpdateProgressRequest = {
        pathId: 'test-path',
        nodeId: 'node-1',
        newLevel: MasteryLevelValue.IN_PROGRESS,
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(mockProgressRepository.updateProgress).toHaveBeenCalledWith(
        'node-1',
        expect.any(MasteryLevel)
      );
    });

    it('should update node to completed', async () => {
      mockPathRepository.findById.mockResolvedValue(createTestPath());
      mockPathRepository.save.mockResolvedValue();
      mockProgressRepository.updateProgress.mockResolvedValue();
      mockProgressRepository.updateLastStudied.mockResolvedValue();

      const request: UpdateProgressRequest = {
        pathId: 'test-path',
        nodeId: 'node-1',
        newLevel: MasteryLevelValue.COMPLETED,
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.statistics).toBeDefined();
    });

    it('should return updated statistics', async () => {
      mockPathRepository.findById.mockResolvedValue(createTestPath());
      mockPathRepository.save.mockResolvedValue();
      mockProgressRepository.updateProgress.mockResolvedValue();
      mockProgressRepository.updateLastStudied.mockResolvedValue();

      const request: UpdateProgressRequest = {
        pathId: 'test-path',
        nodeId: 'node-1',
        newLevel: MasteryLevelValue.COMPLETED,
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.statistics).toBeDefined();
      expect(response.statistics?.totalNodes).toBe(3);
      expect(response.statistics?.completedNodes).toBe(1);
    });

    it('should recommend next nodes after completing one', async () => {
      mockPathRepository.findById.mockResolvedValue(createTestPath());
      mockPathRepository.save.mockResolvedValue();
      mockProgressRepository.updateProgress.mockResolvedValue();
      mockProgressRepository.updateLastStudied.mockResolvedValue();

      const request: UpdateProgressRequest = {
        pathId: 'test-path',
        nodeId: 'node-1',
        newLevel: MasteryLevelValue.COMPLETED,
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.nextRecommendedNodes).toBeDefined();
      expect(response.nextRecommendedNodes).toContain('node-2');
    });

    it('should update path in repository', async () => {
      mockPathRepository.findById.mockResolvedValue(createTestPath());
      mockPathRepository.save.mockResolvedValue();
      mockProgressRepository.updateProgress.mockResolvedValue();
      mockProgressRepository.updateLastStudied.mockResolvedValue();

      const request: UpdateProgressRequest = {
        pathId: 'test-path',
        nodeId: 'node-1',
        newLevel: MasteryLevelValue.COMPLETED,
      };

      await useCase.execute(request);

      expect(mockPathRepository.save).toHaveBeenCalled();
    });

    it('should reset node progress', async () => {
      // Create a path with one completed node
      const path = createTestPath();
      const updatedPath = path.markNodeCompleted('node-1');
      mockPathRepository.findById.mockResolvedValue(updatedPath);
      mockPathRepository.save.mockResolvedValue();
      mockProgressRepository.updateProgress.mockResolvedValue();
      mockProgressRepository.updateLastStudied.mockResolvedValue();

      const request: UpdateProgressRequest = {
        pathId: 'test-path',
        nodeId: 'node-1',
        newLevel: MasteryLevelValue.NOT_STARTED,
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.statistics?.completedNodes).toBe(0);
    });
  });
});
