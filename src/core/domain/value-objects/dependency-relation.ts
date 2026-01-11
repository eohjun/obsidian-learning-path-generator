/**
 * DependencyRelation Value Object
 * Immutable value object representing dependency relations between notes
 *
 * Types:
 * - PREREQUISITE: Must learn first (A must be known to understand B)
 * - RELATED: Related (good to learn together)
 * - OPTIONAL: Optional (may be helpful)
 */

export enum DependencyType {
  PREREQUISITE = 'prerequisite',
  RELATED = 'related',
  OPTIONAL = 'optional',
}

export interface DependencyRelationData {
  sourceId: string;
  targetId: string;
  type: string;
  confidence: number;
}

export class DependencyRelation {
  private constructor(
    private readonly _sourceId: string,
    private readonly _targetId: string,
    private readonly _type: DependencyType,
    private readonly _confidence: number
  ) {}

  // Getters
  get sourceId(): string {
    return this._sourceId;
  }

  get targetId(): string {
    return this._targetId;
  }

  get type(): DependencyType {
    return this._type;
  }

  get confidence(): number {
    return this._confidence;
  }

  // Factory methods
  static prerequisite(
    sourceId: string,
    targetId: string,
    confidence: number = 1.0
  ): DependencyRelation {
    return DependencyRelation.create(
      sourceId,
      targetId,
      DependencyType.PREREQUISITE,
      confidence
    );
  }

  static related(
    sourceId: string,
    targetId: string,
    confidence: number = 1.0
  ): DependencyRelation {
    return DependencyRelation.create(
      sourceId,
      targetId,
      DependencyType.RELATED,
      confidence
    );
  }

  static optional(
    sourceId: string,
    targetId: string,
    confidence: number = 1.0
  ): DependencyRelation {
    return DependencyRelation.create(
      sourceId,
      targetId,
      DependencyType.OPTIONAL,
      confidence
    );
  }

  private static create(
    sourceId: string,
    targetId: string,
    type: DependencyType,
    confidence: number
  ): DependencyRelation {
    // Validation
    if (!sourceId || !targetId) {
      throw new Error('Source and target IDs must not be empty');
    }

    if (sourceId === targetId) {
      throw new Error('Self-reference dependency is not allowed');
    }

    // Clamp confidence between 0 and 1
    const clampedConfidence = Math.max(0, Math.min(1, confidence));

    return new DependencyRelation(sourceId, targetId, type, clampedConfidence);
  }

  static fromObject(data: DependencyRelationData): DependencyRelation {
    const type = DependencyRelation.parseType(data.type);
    return DependencyRelation.create(
      data.sourceId,
      data.targetId,
      type,
      data.confidence
    );
  }

  private static parseType(typeStr: string): DependencyType {
    switch (typeStr.toLowerCase()) {
      case 'prerequisite':
        return DependencyType.PREREQUISITE;
      case 'related':
        return DependencyType.RELATED;
      case 'optional':
        return DependencyType.OPTIONAL;
      default:
        return DependencyType.RELATED;
    }
  }

  // Type checks
  isPrerequisite(): boolean {
    return this._type === DependencyType.PREREQUISITE;
  }

  isRelated(): boolean {
    return this._type === DependencyType.RELATED;
  }

  isOptional(): boolean {
    return this._type === DependencyType.OPTIONAL;
  }

  // Operations
  inverse(): DependencyRelation {
    return DependencyRelation.create(
      this._targetId,
      this._sourceId,
      this._type,
      this._confidence
    );
  }

  // Comparison (equality based on source, target, type - not confidence)
  equals(other: DependencyRelation): boolean {
    return (
      this._sourceId === other._sourceId &&
      this._targetId === other._targetId &&
      this._type === other._type
    );
  }

  // Serialization
  toObject(): DependencyRelationData {
    return {
      sourceId: this._sourceId,
      targetId: this._targetId,
      type: this._type,
      confidence: this._confidence,
    };
  }

  toDisplayString(): string {
    const typeLabel = this.getTypeLabel();
    return `${this._sourceId} → ${this._targetId} (${typeLabel})`;
  }

  private getTypeLabel(): string {
    switch (this._type) {
      case DependencyType.PREREQUISITE:
        return 'Prerequisite';
      case DependencyType.RELATED:
        return 'Related';
      case DependencyType.OPTIONAL:
        return 'Optional';
    }
  }
}
