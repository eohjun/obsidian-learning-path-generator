/**
 * GenerateLearningPathUseCase Tests
 * 학습 경로 생성 유스케이스 테스트
 */

import { GenerateLearningPathUseCase } from '../../../src/core/application/use-cases/generate-learning-path';
import {
  INoteRepository,
  NoteData,
  IPathRepository,
  DependencyRelation,
  LearningPath,
  DependencyAnalyzer,
} from '../../../src/core/domain';
import { GeneratePathRequest } from '../../../src/core/application/dtos';

describe('GenerateLearningPathUseCase', () => {
  let useCase: GenerateLearningPathUseCase;
  let mockNoteRepository: jest.Mocked<INoteRepository>;
  let mockPathRepository: jest.Mocked<IPathRepository>;

  const createMockNote = (
    id: string,
    links: string[] = [],
    backlinks: string[] = []
  ): NoteData => ({
    id,
    path: `notes/${id}.md`,
    basename: id,
    content: `# ${id}\n\nContent for ${id}`,
    metadata: {
      tags: ['test'],
      links,
      backlinks,
      frontmatter: {},
    },
  });

  beforeEach(() => {
    mockNoteRepository = {
      getNote: jest.fn(),
      getNoteByPath: jest.fn(),
      getLinkedNotes: jest.fn(),
      getBacklinks: jest.fn(),
      getNotesByTag: jest.fn(),
      getAllNotes: jest.fn(),
      exists: jest.fn(),
    };

    mockPathRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByGoalNote: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    };

    useCase = new GenerateLearningPathUseCase(
      mockNoteRepository,
      mockPathRepository,
      new DependencyAnalyzer()
    );
  });

  describe('execute', () => {
    it('should return error when no notes found', async () => {
      mockNoteRepository.getAllNotes.mockResolvedValue([]);

      const request: GeneratePathRequest = {
        name: 'Test Path',
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('No notes found');
    });

    it('should generate path from single note', async () => {
      const note = createMockNote('note-1');
      mockNoteRepository.getAllNotes.mockResolvedValue([note]);
      mockNoteRepository.getLinkedNotes.mockResolvedValue([]);
      mockPathRepository.save.mockResolvedValue();

      const request: GeneratePathRequest = {
        name: 'Single Note Path',
        startNoteIds: ['note-1'],
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.path).toBeDefined();
      expect(response.path?.goalNoteTitle).toBe('Single Note Path');
      expect(response.nodes).toHaveLength(1);
    });

    it('should generate path with linked notes', async () => {
      const noteA = createMockNote('A', ['B', 'C']);
      const noteB = createMockNote('B', ['D']);
      const noteC = createMockNote('C', ['D']);
      const noteD = createMockNote('D');

      mockNoteRepository.getAllNotes.mockResolvedValue([
        noteA,
        noteB,
        noteC,
        noteD,
      ]);
      mockNoteRepository.getLinkedNotes.mockImplementation(async (id) => {
        if (id === 'A') return [noteB, noteC];
        if (id === 'B') return [noteD];
        if (id === 'C') return [noteD];
        return [];
      });
      mockPathRepository.save.mockResolvedValue();

      const request: GeneratePathRequest = {
        name: 'Linked Notes Path',
        startNoteIds: ['A'],
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.nodes).toBeDefined();
      expect(response.nodes!.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate path to goal node', async () => {
      // A -> B -> C -> D (linear chain)
      const noteA = createMockNote('A', ['B']);
      const noteB = createMockNote('B', ['C'], ['A']);
      const noteC = createMockNote('C', ['D'], ['B']);
      const noteD = createMockNote('D', [], ['C']);

      mockNoteRepository.getAllNotes.mockResolvedValue([
        noteA,
        noteB,
        noteC,
        noteD,
      ]);
      mockNoteRepository.getNote.mockImplementation(async (id) => {
        const notes: Record<string, NoteData> = {
          A: noteA,
          B: noteB,
          C: noteC,
          D: noteD,
        };
        return notes[id] || null;
      });
      mockPathRepository.save.mockResolvedValue();

      const request: GeneratePathRequest = {
        name: 'Goal-Oriented Path',
        goalNoteId: 'D',
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.path).toBeDefined();
      // Goal should be the last node
      if (response.nodes && response.nodes.length > 0) {
        const lastNode = response.nodes[response.nodes.length - 1];
        expect(lastNode.noteId).toBe('D');
      }
    });

    it('should filter notes by folder', async () => {
      const noteInFolder = { ...createMockNote('note-1'), path: 'topics/note-1.md' };
      const noteOutside = { ...createMockNote('note-2'), path: 'other/note-2.md' };

      mockNoteRepository.getAllNotes.mockResolvedValue([noteInFolder]);
      mockPathRepository.save.mockResolvedValue();

      const request: GeneratePathRequest = {
        name: 'Folder Filtered Path',
        folder: 'topics',
      };

      const response = await useCase.execute(request);

      expect(mockNoteRepository.getAllNotes).toHaveBeenCalledWith({
        folder: 'topics',
        excludeFolders: undefined,
      });
    });

    it('should exclude specified folders', async () => {
      mockNoteRepository.getAllNotes.mockResolvedValue([createMockNote('note-1')]);
      mockPathRepository.save.mockResolvedValue();

      const request: GeneratePathRequest = {
        name: 'Exclude Test',
        excludeFolders: ['archive', 'templates'],
      };

      await useCase.execute(request);

      expect(mockNoteRepository.getAllNotes).toHaveBeenCalledWith({
        folder: undefined,
        excludeFolders: ['archive', 'templates'],
      });
    });

    it('should save generated path to repository', async () => {
      mockNoteRepository.getAllNotes.mockResolvedValue([createMockNote('note-1')]);
      mockPathRepository.save.mockResolvedValue();

      const request: GeneratePathRequest = {
        name: 'Saved Path',
        description: 'Test description',
      };

      await useCase.execute(request);

      expect(mockPathRepository.save).toHaveBeenCalled();
      const savedPath = mockPathRepository.save.mock.calls[0][0];
      expect(savedPath.goalNoteTitle).toBe('Saved Path');
    });

    it('should return levels for parallel learning', async () => {
      // Diamond dependency: A -> B, A -> C, B -> D, C -> D
      const noteA = createMockNote('A', ['B', 'C']);
      const noteB = createMockNote('B', ['D'], ['A']);
      const noteC = createMockNote('C', ['D'], ['A']);
      const noteD = createMockNote('D', [], ['B', 'C']);

      mockNoteRepository.getAllNotes.mockResolvedValue([
        noteA,
        noteB,
        noteC,
        noteD,
      ]);
      mockPathRepository.save.mockResolvedValue();

      const request: GeneratePathRequest = {
        name: 'Levels Test',
        startNoteIds: ['A'],
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.levels).toBeDefined();
      // Levels should group parallel learnable nodes
      if (response.levels) {
        expect(response.levels.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should handle circular dependency gracefully', async () => {
      // A -> B -> C -> A (cycle)
      const noteA = createMockNote('A', ['B'], ['C']);
      const noteB = createMockNote('B', ['C'], ['A']);
      const noteC = createMockNote('C', ['A'], ['B']);

      mockNoteRepository.getAllNotes.mockResolvedValue([noteA, noteB, noteC]);
      mockPathRepository.save.mockResolvedValue();

      const request: GeneratePathRequest = {
        name: 'Cycle Test',
        startNoteIds: ['A'],
      };

      const response = await useCase.execute(request);

      // Should still succeed but with warning
      expect(response.success).toBe(true);
      expect(response.warnings).toBeDefined();
      expect(response.warnings?.some((w) => w.toLowerCase().includes('circular') || w.toLowerCase().includes('cycle'))).toBe(true);
    });
  });
});
