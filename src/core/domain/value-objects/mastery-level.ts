/**
 * MasteryLevel Value Object
 * 학습 숙달도를 나타내는 불변 값 객체
 *
 * 상태 전이:
 * NOT_STARTED → IN_PROGRESS → COMPLETED
 *      ↑___________reset___________↓
 */

export enum MasteryLevelValue {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export class MasteryLevel {
  private constructor(private readonly _value: MasteryLevelValue) {}

  get value(): MasteryLevelValue {
    return this._value;
  }

  // Factory methods
  static notStarted(): MasteryLevel {
    return new MasteryLevel(MasteryLevelValue.NOT_STARTED);
  }

  static inProgress(): MasteryLevel {
    return new MasteryLevel(MasteryLevelValue.IN_PROGRESS);
  }

  static completed(): MasteryLevel {
    return new MasteryLevel(MasteryLevelValue.COMPLETED);
  }

  static fromString(value: string): MasteryLevel {
    switch (value.toLowerCase()) {
      case 'in_progress':
        return MasteryLevel.inProgress();
      case 'completed':
        return MasteryLevel.completed();
      case 'not_started':
      default:
        return MasteryLevel.notStarted();
    }
  }

  // State checks
  isNotStarted(): boolean {
    return this._value === MasteryLevelValue.NOT_STARTED;
  }

  isInProgress(): boolean {
    return this._value === MasteryLevelValue.IN_PROGRESS;
  }

  isCompleted(): boolean {
    return this._value === MasteryLevelValue.COMPLETED;
  }

  // State transitions (immutable - returns new instance)
  startLearning(): MasteryLevel {
    if (this._value === MasteryLevelValue.COMPLETED) {
      return this; // Already completed, no change
    }
    return MasteryLevel.inProgress();
  }

  complete(): MasteryLevel {
    return MasteryLevel.completed();
  }

  reset(): MasteryLevel {
    return MasteryLevel.notStarted();
  }

  // Comparison
  equals(other: MasteryLevel): boolean {
    return this._value === other._value;
  }

  // Progress calculation
  progressPercent(): number {
    switch (this._value) {
      case MasteryLevelValue.NOT_STARTED:
        return 0;
      case MasteryLevelValue.IN_PROGRESS:
        return 50;
      case MasteryLevelValue.COMPLETED:
        return 100;
    }
  }

  // Serialization
  toString(): string {
    return this._value;
  }

  toDisplayLabel(): string {
    switch (this._value) {
      case MasteryLevelValue.NOT_STARTED:
        return '미학습';
      case MasteryLevelValue.IN_PROGRESS:
        return '학습중';
      case MasteryLevelValue.COMPLETED:
        return '완료';
    }
  }

  toIcon(): string {
    switch (this._value) {
      case MasteryLevelValue.NOT_STARTED:
        return '⬜';
      case MasteryLevelValue.IN_PROGRESS:
        return '🔄';
      case MasteryLevelValue.COMPLETED:
        return '✅';
    }
  }
}
