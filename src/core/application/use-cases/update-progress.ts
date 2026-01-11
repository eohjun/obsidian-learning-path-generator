/**
 * UpdateProgressUseCase
 * Learning progress update use case
 *
 * Updates learning status of individual nodes and returns statistics.
 */

import {
  IPathRepository,
  IProgressRepository,
  LearningPath,
  MasteryLevel,
  MasteryLevelValue,
} from '../../domain';
import {
  UpdateProgressRequest,
  UpdateProgressResponse,
} from '../dtos/update-progress.dto';

export class UpdateProgressUseCase {
  constructor(
    private readonly pathRepository: IPathRepository,
    private readonly progressRepository: IProgressRepository
  ) {}

  async execute(request: UpdateProgressRequest): Promise<UpdateProgressResponse> {
    try {
      // 1. Get path
      const path = await this.pathRepository.findById(request.pathId);
      if (!path) {
        return {
          success: false,
          error: `Path '${request.pathId}' not found`,
        };
      }

      // 2. Check if node exists
      const node = path.getNode(request.nodeId);
      if (!node) {
        return {
          success: false,
          error: `Node '${request.nodeId}' not found in path`,
        };
      }

      // 3. Convert level value to MasteryLevel
      const masteryLevel = this.valueToMasteryLevel(request.newLevel);

      // 4. Update path with new progress
      const updatedPath = path.updateNodeProgress(request.nodeId, masteryLevel);

      // 5. Update progress repository
      await this.progressRepository.updateProgress(request.nodeId, masteryLevel);

      // 6. Update last studied time
      if (
        request.newLevel === MasteryLevelValue.IN_PROGRESS ||
        request.newLevel === MasteryLevelValue.COMPLETED
      ) {
        await this.progressRepository.updateLastStudied(
          request.nodeId,
          new Date()
        );
      }

      // 7. Increment study count only on completion
      if (request.newLevel === MasteryLevelValue.COMPLETED) {
        await this.progressRepository.incrementStudyCount(request.nodeId);
      }

      // 8. Save updated path
      await this.pathRepository.save(updatedPath);

      // 9. Calculate statistics
      const statistics = updatedPath.getStatistics();

      // 10. Get next recommended nodes
      const nextRecommendedNodes = this.getNextRecommendedNodes(updatedPath);

      return {
        success: true,
        statistics: statistics.toObject(),
        nextRecommendedNodes,
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
   * Convert MasteryLevelValue to MasteryLevel object
   */
  private valueToMasteryLevel(value: MasteryLevelValue): MasteryLevel {
    switch (value) {
      case MasteryLevelValue.NOT_STARTED:
        return MasteryLevel.notStarted();
      case MasteryLevelValue.IN_PROGRESS:
        return MasteryLevel.inProgress();
      case MasteryLevelValue.COMPLETED:
        return MasteryLevel.completed();
      default:
        return MasteryLevel.notStarted();
    }
  }

  /**
   * Return next recommended nodes for learning
   */
  private getNextRecommendedNodes(path: LearningPath): string[] {
    // Get first incomplete node
    const currentNode = path.getCurrentNode();
    if (!currentNode) {
      return []; // All completed
    }

    // Return current and next node
    const notStarted = path.getNotStartedNodes();
    const recommendations = notStarted.slice(0, 3).map((n) => n.noteId);

    // If current node is in progress, include it first
    if (currentNode.isInProgress()) {
      return [
        currentNode.noteId,
        ...recommendations.filter((id) => id !== currentNode.noteId),
      ].slice(0, 3);
    }

    return recommendations;
  }
}
