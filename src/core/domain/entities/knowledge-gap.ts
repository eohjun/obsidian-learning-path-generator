/**
 * KnowledgeGap Entity
 * Entity representing knowledge required for learning but not present in the vault
 */

export interface KnowledgeGapData {
  id: string;
  concept: string;
  description: string;
  requiredBy: string[];
  suggestedResources: string[];
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
}

export class KnowledgeGap {
  private constructor(
    private readonly _id: string,
    private readonly _concept: string,
    private readonly _description: string,
    private readonly _requiredBy: string[],
    private readonly _suggestedResources: string[],
    private readonly _priority: 'high' | 'medium' | 'low',
    private readonly _createdAt: Date
  ) {}

  // Getters
  get id(): string {
    return this._id;
  }

  get concept(): string {
    return this._concept;
  }

  get description(): string {
    return this._description;
  }

  get requiredBy(): ReadonlyArray<string> {
    return this._requiredBy;
  }

  get suggestedResources(): ReadonlyArray<string> {
    return this._suggestedResources;
  }

  get priority(): 'high' | 'medium' | 'low' {
    return this._priority;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // Factory methods
  static create(params: {
    id?: string;
    concept: string;
    description: string;
    requiredBy?: string[];
    suggestedResources?: string[];
    priority?: 'high' | 'medium' | 'low';
  }): KnowledgeGap {
    if (!params.concept) {
      throw new Error('Concept is required');
    }

    const id =
      params.id ??
      `gap-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return new KnowledgeGap(
      id,
      params.concept,
      params.description || '',
      params.requiredBy ?? [],
      params.suggestedResources ?? [],
      params.priority ?? 'medium',
      new Date()
    );
  }

  static fromData(data: KnowledgeGapData): KnowledgeGap {
    return new KnowledgeGap(
      data.id,
      data.concept,
      data.description,
      data.requiredBy,
      data.suggestedResources,
      data.priority,
      new Date(data.createdAt)
    );
  }

  // Priority checks
  isHighPriority(): boolean {
    return this._priority === 'high';
  }

  isMediumPriority(): boolean {
    return this._priority === 'medium';
  }

  isLowPriority(): boolean {
    return this._priority === 'low';
  }

  // Operations
  addRequiredBy(noteId: string): KnowledgeGap {
    if (this._requiredBy.includes(noteId)) {
      return this;
    }

    return new KnowledgeGap(
      this._id,
      this._concept,
      this._description,
      [...this._requiredBy, noteId],
      this._suggestedResources,
      this._priority,
      this._createdAt
    );
  }

  addSuggestedResource(resource: string): KnowledgeGap {
    if (this._suggestedResources.includes(resource)) {
      return this;
    }

    return new KnowledgeGap(
      this._id,
      this._concept,
      this._description,
      this._requiredBy,
      [...this._suggestedResources, resource],
      this._priority,
      this._createdAt
    );
  }

  withPriority(priority: 'high' | 'medium' | 'low'): KnowledgeGap {
    return new KnowledgeGap(
      this._id,
      this._concept,
      this._description,
      this._requiredBy,
      this._suggestedResources,
      priority,
      this._createdAt
    );
  }

  // Serialization
  toData(): KnowledgeGapData {
    return {
      id: this._id,
      concept: this._concept,
      description: this._description,
      requiredBy: [...this._requiredBy],
      suggestedResources: [...this._suggestedResources],
      priority: this._priority,
      createdAt: this._createdAt.toISOString(),
    };
  }

  toDisplayString(): string {
    const priorityIcon = this.getPriorityIcon();
    return `${priorityIcon} ${this._concept}`;
  }

  private getPriorityIcon(): string {
    switch (this._priority) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
    }
  }

  toSuggestedNoteTitle(): string {
    return this._concept;
  }
}
