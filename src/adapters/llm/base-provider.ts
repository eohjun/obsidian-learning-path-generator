/**
 * Base LLM Provider
 * Abstract class providing common functionality for all LLM Providers
 */

import { requestUrl, RequestUrlParam } from 'obsidian';
import {
  ILLMProvider,
  LLMMessage,
  LLMGenerateOptions,
  LLMResponse,
  AIProviderType,
  DependencyAnalysisResult,
  KnowledgeGapAnalysisResult,
  LearningPathAnalysisResult,
  ConceptExtractionResult,
  DependencyRelation,
  KnowledgeGap,
} from '../../core/domain';

export abstract class BaseProvider implements ILLMProvider {
  protected apiKey: string = '';
  protected model: string = '';

  abstract readonly name: string;
  abstract readonly providerType: AIProviderType;

  get modelId(): string {
    return this.model;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setModel(modelId: string): void {
    this.model = modelId;
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  abstract generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse>;
  abstract testApiKey(apiKey: string): Promise<boolean>;

  async simpleGenerate(
    userPrompt: string,
    systemPrompt?: string,
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    const messages: LLMMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });
    return this.generate(messages, options);
  }

  protected async makeRequest<T>(options: RequestUrlParam): Promise<T> {
    try {
      const response = await requestUrl(options);
      return response.json as T;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  protected normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('401') || message.includes('unauthorized') || message.includes('invalid api key')) {
        return new Error('Authentication failed: Invalid API key.');
      }
      if (message.includes('429') || message.includes('rate limit')) {
        return new Error('Rate limit exceeded: Please try again later.');
      }
      if (message.includes('timeout') || message.includes('timed out')) {
        return new Error('Request timeout: Please check your network connection.');
      }
      if (message.includes('500') || message.includes('internal server')) {
        return new Error('Server error: Please try again later.');
      }
      return error;
    }
    return new Error('An unknown error occurred.');
  }

  protected handleError(error: unknown): LLMResponse {
    const normalizedError = this.normalizeError(error);
    return {
      success: false,
      content: '',
      error: normalizedError.message,
    };
  }

  // ============================================
  // Learning Path Specific Methods
  // ============================================

  async analyzeDependencies(
    noteContent: string,
    linkedNoteContents: string[]
  ): Promise<LLMResponse<DependencyAnalysisResult>> {
    const prompt = this.buildDependencyAnalysisPrompt(noteContent, linkedNoteContents);
    const response = await this.simpleGenerate(prompt);

    if (!response.success) {
      return { success: false, error: response.error };
    }

    const parsed = this.parseDependencyResponse(response.content || '');
    return { success: true, data: parsed, rawResponse: response.content };
  }

  async identifyKnowledgeGaps(
    pathDescription: string,
    existingConcepts: string[]
  ): Promise<LLMResponse<KnowledgeGapAnalysisResult>> {
    const prompt = this.buildKnowledgeGapPrompt(pathDescription, existingConcepts);
    const response = await this.simpleGenerate(prompt);

    if (!response.success) {
      return { success: false, error: response.error };
    }

    const parsed = this.parseKnowledgeGapResponse(response.content || '');
    return { success: true, data: parsed, rawResponse: response.content };
  }

  async suggestLearningOrder(
    concepts: string[],
    currentDependencies: DependencyRelation[]
  ): Promise<LLMResponse<string[]>> {
    const prompt = this.buildLearningOrderPrompt(concepts, currentDependencies);
    const response = await this.simpleGenerate(prompt);

    if (!response.success) {
      return { success: false, error: response.error };
    }

    const parsed = this.parseLearningOrderResponse(response.content || '');
    return { success: true, data: parsed, rawResponse: response.content };
  }

  async analyzeNotesForLearningPath(
    goalNote: { title: string; content: string },
    relatedNotes: Array<{ title: string; content: string }>
  ): Promise<LLMResponse<LearningPathAnalysisResult>> {
    const prompt = this.buildLearningPathPrompt(goalNote, relatedNotes);
    const response = await this.simpleGenerate(prompt);

    if (!response.success) {
      return { success: false, error: response.error };
    }

    const parsed = this.parseLearningPathResponse(
      response.content || '',
      goalNote.title,
      relatedNotes.map((n) => n.title)
    );
    return { success: true, data: parsed, rawResponse: response.content };
  }

  async extractPrerequisiteConcepts(
    goalNote: { title: string; content: string }
  ): Promise<LLMResponse<ConceptExtractionResult>> {
    const prompt = this.buildConceptExtractionPrompt(goalNote);
    const response = await this.simpleGenerate(prompt);

    if (!response.success) {
      return { success: false, error: response.error };
    }

    const parsed = this.parseConceptExtractionResponse(response.content || '', goalNote.title);
    return { success: true, data: parsed, rawResponse: response.content };
  }

  // ============================================
  // Prompt Builders
  // ============================================

  private buildDependencyAnalysisPrompt(noteContent: string, linkedNoteContents: string[]): string {
    const linkedContext = linkedNoteContents
      .map((content, i) => `[Linked Note ${i + 1}]\n${content.slice(0, 500)}`)
      .join('\n\n');

    return `Please analyze the conceptual dependencies of the following note.

[Target Note]
${noteContent.slice(0, 2000)}

${linkedContext ? `[Linked Notes]\n${linkedContext}` : ''}

Respond in JSON format:
\`\`\`json
{
  "dependencies": [
    {"source": "ConceptA", "target": "ConceptB", "type": "prerequisite", "confidence": 0.8}
  ],
  "concepts": ["extracted core concepts"],
  "confidence": 0.85
}
\`\`\``;
  }

  private buildKnowledgeGapPrompt(pathDescription: string, existingConcepts: string[]): string {
    return `Please analyze the learning path and identify knowledge gaps.

[Learning Path]
${pathDescription}

[Concepts in Vault]
${existingConcepts.join(', ')}

Respond in JSON format:
\`\`\`json
{
  "gaps": [
    {"concept": "missing concept", "reason": "why it's needed", "priority": "high"}
  ],
  "summary": "analysis summary"
}
\`\`\``;
  }

  private buildLearningOrderPrompt(concepts: string[], dependencies: DependencyRelation[]): string {
    const depList = dependencies.map((d) => `${d.sourceId} → ${d.targetId}`).join('\n');

    return `Please suggest the optimal learning order for the following concepts.

[Concepts]
${concepts.join(', ')}

[Known Dependencies]
${depList || 'None'}

Respond with a JSON array of learning order:
\`\`\`json
["first concept to learn", "second", ...]
\`\`\``;
  }

  private buildLearningPathPrompt(
    goalNote: { title: string; content: string },
    relatedNotes: Array<{ title: string; content: string }>
  ): string {
    const notesContext = relatedNotes
      .map((n) => `### ${n.title}\n${n.content.slice(0, 1500)}`)
      .join('\n\n');

    const noteTitles = relatedNotes.map((n) => n.title).join(', ');

    return `You are an educational expert who designs learning paths.

## Goal
Suggest the optimal learning order to fully understand the "${goalNote.title}" note,
and **identify knowledge gaps that are necessary for deep understanding but not currently in the vault**.

## Goal Note Content
${goalNote.content.slice(0, 2000)}

## Related Notes (currently in vault)
${notesContext}

## Analysis Request
Analyze the above notes and respond in JSON format:

\`\`\`json
{
  "learningOrder": ["first note to learn", "next note", ..., "${goalNote.title}"],
  "dependencies": [
    {"from": "prerequisite note", "to": "dependent note", "reason": "reason"}
  ],
  "estimatedMinutes": {
    "noteTitle": estimatedMinutes
  },
  "knowledgeGaps": [
    {
      "concept": "missing concept/topic",
      "reason": "why this concept is needed",
      "priority": "high|medium|low",
      "suggestedResources": ["recommended resources (books, courses, keywords, etc.)"]
    }
  ]
}
\`\`\`

## Important Rules

### Learning Order (learningOrder)
1. Sort from foundational concepts to advanced concepts
2. Goal note ("${goalNote.title}") must be placed last
3. Related notes unnecessary for goal achievement can be excluded
4. Estimated learning time ranges from 5-60 minutes based on note complexity

### Knowledge Gap Analysis (knowledgeGaps) - Very Important!
1. **Identify concepts essential for deep understanding of the goal note but not currently in the vault**
2. Notes currently in vault: ${noteTitles}
3. Knowledge gap examples:
   - If goal note is "Measurement Problem in Quantum Mechanics" but vault lacks "Probabilistic Interpretation" note → gap
   - If goal note is "AI Ethics" but vault lacks "Trolley Problem" note → gap
4. Priority criteria:
   - high: Understanding the goal note is difficult without this concept
   - medium: Helpful for understanding but not essential
   - low: Good to know for advanced learning
5. suggestedResources: Suggest specific learning materials like search keywords, related books, online courses`;
  }

  private buildConceptExtractionPrompt(goalNote: { title: string; content: string }): string {
    return `You are an expert in knowledge graphs and learning design.

## Goal
Extract **prerequisite concepts that must be known** to fully understand the "${goalNote.title}" note.

## Note Content
${goalNote.content.slice(0, 3000)}

## Analysis Request
Please respond in JSON format with background knowledge and prerequisite concepts needed to deeply understand this note:

\`\`\`json
{
  "mainTopic": "The core topic this note covers (one sentence)",
  "prerequisites": [
    {
      "concept": "prerequisite concept name",
      "description": "why this concept is needed (1-2 sentences)",
      "importance": "essential|helpful|optional"
    }
  ],
  "keywords": ["related keywords for semantic search"]
}
\`\`\`

## Important Rules
1. **Prerequisites**:
   - essential: Understanding the note content is difficult without this concept
   - helpful: Helps with understanding but not essential
   - optional: Related concepts for advanced learning

2. **Be Specific**:
   - Instead of broad concepts like "philosophy", use specific ones like "Plato's Theory of Forms", "Kant's Synthetic A Priori"
   - Instead of "programming", use specific concepts like "recursive functions", "tree data structures"

3. **Keywords**:
   - Specific words/phrases that can be used for note search
   - Include similar concepts and related terms

4. **Quantity Limits**:
   - prerequisites: 3-10 (only the most important)
   - keywords: 5-15`;
  }

  // ============================================
  // Response Parsers
  // ============================================

  private parseDependencyResponse(response: string): DependencyAnalysisResult {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          dependencies: (parsed.dependencies || []).map((d: any) =>
            DependencyRelation.prerequisite(d.source, d.target, d.confidence || 0.7)
          ),
          concepts: parsed.concepts || [],
          confidence: parsed.confidence || 0.5,
        };
      }
    } catch (e) {
      console.error('Failed to parse dependency response:', e);
    }
    return { dependencies: [], concepts: [], confidence: 0 };
  }

  private parseKnowledgeGapResponse(response: string): KnowledgeGapAnalysisResult {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          gaps: (parsed.gaps || []).map((g: any) =>
            KnowledgeGap.create({
              concept: g.concept,
              description: g.reason || '',
              suggestedResources: [],
              priority: (g.priority as 'high' | 'medium' | 'low') || 'medium',
            })
          ),
          summary: parsed.summary || '',
        };
      }
    } catch (e) {
      console.error('Failed to parse knowledge gap response:', e);
    }
    return { gaps: [], summary: '' };
  }

  private parseLearningOrderResponse(response: string): string[] {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
    } catch (e) {
      console.error('Failed to parse learning order response:', e);
    }
    return [];
  }

  private parseLearningPathResponse(
    response: string,
    goalTitle: string,
    availableTitles: string[]
  ): LearningPathAnalysisResult {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);

        const allAvailable = [...availableTitles, goalTitle];
        const validOrder = (parsed.learningOrder as string[]).filter((title: string) =>
          allAvailable.includes(title)
        );

        if (!validOrder.includes(goalTitle)) {
          validOrder.push(goalTitle);
        } else if (validOrder[validOrder.length - 1] !== goalTitle) {
          const idx = validOrder.indexOf(goalTitle);
          validOrder.splice(idx, 1);
          validOrder.push(goalTitle);
        }

        // Parse knowledge gaps - handle both old string[] and new object[] formats
        const rawGaps = parsed.knowledgeGaps || [];
        const knowledgeGaps = rawGaps.map((gap: any) => {
          if (typeof gap === 'string') {
            // Old format compatibility
            return {
              concept: gap,
              reason: '',
              priority: 'medium' as const,
              suggestedResources: [],
            };
          }
          return {
            concept: gap.concept || '',
            reason: gap.reason || '',
            priority: (gap.priority as 'high' | 'medium' | 'low') || 'medium',
            suggestedResources: gap.suggestedResources || [],
          };
        });

        return {
          learningOrder: validOrder,
          dependencies: parsed.dependencies || [],
          estimatedMinutes: parsed.estimatedMinutes || {},
          knowledgeGaps,
        };
      }
    } catch (e) {
      console.error('Failed to parse LLM response:', e);
    }

    const fallbackOrder = availableTitles.filter((t) => t !== goalTitle);
    fallbackOrder.push(goalTitle);
    return {
      learningOrder: fallbackOrder,
      dependencies: [],
      estimatedMinutes: {},
      knowledgeGaps: [],
    };
  }

  private parseConceptExtractionResponse(
    response: string,
    goalTitle: string
  ): ConceptExtractionResult {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          mainTopic: parsed.mainTopic || goalTitle,
          prerequisites: (parsed.prerequisites || []).map((p: any) => ({
            concept: p.concept || '',
            description: p.description || '',
            importance: (p.importance as 'essential' | 'helpful' | 'optional') || 'helpful',
          })),
          keywords: parsed.keywords || [],
        };
      }
    } catch (e) {
      console.error('Failed to parse concept extraction response:', e);
    }

    // Fallback: empty result
    return {
      mainTopic: goalTitle,
      prerequisites: [],
      keywords: [],
    };
  }
}
