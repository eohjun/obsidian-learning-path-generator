/**
 * Claude LLM Provider
 * Anthropic Claude API를 사용한 LLM Provider 구현
 */

import {
  ILLMProvider,
  LLMResponse,
  DependencyAnalysisResult,
  KnowledgeGapAnalysisResult,
  DependencyRelation,
  KnowledgeGap,
} from '../../core/domain';

export interface ClaudeProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class ClaudeLLMProvider implements ILLMProvider {
  readonly name = 'Claude';
  private readonly config: Required<ClaudeProviderConfig>;

  constructor(config: ClaudeProviderConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? 'claude-sonnet-4-20250514',
      maxTokens: config.maxTokens ?? 4096,
    };
  }

  async isAvailable(): Promise<boolean> {
    return this.config.apiKey.length > 0;
  }

  async analyzeDependencies(
    noteContent: string,
    linkedNoteContents: string[]
  ): Promise<LLMResponse<DependencyAnalysisResult>> {
    const prompt = this.buildDependencyAnalysisPrompt(noteContent, linkedNoteContents);

    try {
      const response = await this.callClaude(prompt);
      const parsed = this.parseDependencyResponse(response);
      return {
        success: true,
        data: parsed,
        rawResponse: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async identifyKnowledgeGaps(
    pathDescription: string,
    existingConcepts: string[]
  ): Promise<LLMResponse<KnowledgeGapAnalysisResult>> {
    const prompt = this.buildKnowledgeGapPrompt(pathDescription, existingConcepts);

    try {
      const response = await this.callClaude(prompt);
      const parsed = this.parseKnowledgeGapResponse(response);
      return {
        success: true,
        data: parsed,
        rawResponse: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async suggestLearningOrder(
    concepts: string[],
    currentDependencies: DependencyRelation[]
  ): Promise<LLMResponse<string[]>> {
    const prompt = this.buildLearningOrderPrompt(concepts, currentDependencies);

    try {
      const response = await this.callClaude(prompt);
      const parsed = this.parseLearningOrderResponse(response);
      return {
        success: true,
        data: parsed,
        rawResponse: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 노트 내용을 분석하여 학습 경로 생성
   */
  async analyzeNotesForLearningPath(
    goalNote: { title: string; content: string },
    relatedNotes: Array<{ title: string; content: string }>
  ): Promise<LLMResponse<{
    learningOrder: string[];
    dependencies: Array<{ from: string; to: string; reason: string }>;
    estimatedMinutes: Record<string, number>;
    knowledgeGaps: string[];
  }>> {
    const prompt = this.buildLearningPathPrompt(goalNote, relatedNotes);

    try {
      const response = await this.callClaude(prompt);
      const parsed = this.parseLearningPathResponse(response, goalNote.title, relatedNotes.map(n => n.title));
      return {
        success: true,
        data: parsed,
        rawResponse: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private buildLearningPathPrompt(
    goalNote: { title: string; content: string },
    relatedNotes: Array<{ title: string; content: string }>
  ): string {
    const notesContext = relatedNotes
      .map((n) => `### ${n.title}\n${n.content.slice(0, 1500)}`)
      .join('\n\n');

    return `당신은 학습 경로를 설계하는 교육 전문가입니다.

## 목표
"${goalNote.title}" 노트를 완전히 이해하기 위한 최적의 학습 순서를 제안해주세요.

## 목표 노트 내용
${goalNote.content.slice(0, 2000)}

## 관련 노트들
${notesContext}

## 분석 요청
위 노트들을 분석하여 다음을 JSON 형식으로 답변해주세요:

\`\`\`json
{
  "learningOrder": ["먼저 학습할 노트", "그 다음 노트", ..., "${goalNote.title}"],
  "dependencies": [
    {"from": "선행 노트", "to": "후행 노트", "reason": "이유"}
  ],
  "estimatedMinutes": {
    "노트제목": 예상학습시간(분)
  },
  "knowledgeGaps": ["볼트에 없지만 필요한 개념들"]
}
\`\`\`

규칙:
1. 학습 순서는 기초 개념부터 심화 개념 순으로
2. 목표 노트("${goalNote.title}")는 반드시 마지막에 위치
3. 관련 노트 중 목표 달성에 불필요한 노트는 제외 가능
4. 예상 학습 시간은 노트 복잡도에 따라 5-60분 범위
5. 지식 갭은 이해에 필요하지만 볼트에 없는 개념`;
  }

  private parseLearningPathResponse(
    response: string,
    goalTitle: string,
    availableTitles: string[]
  ): {
    learningOrder: string[];
    dependencies: Array<{ from: string; to: string; reason: string }>;
    estimatedMinutes: Record<string, number>;
    knowledgeGaps: string[];
  } {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);

        // Validate and filter learning order to only include available notes
        const allAvailable = [...availableTitles, goalTitle];
        const validOrder = (parsed.learningOrder as string[]).filter(
          (title: string) => allAvailable.includes(title)
        );

        // Ensure goal is at the end
        if (!validOrder.includes(goalTitle)) {
          validOrder.push(goalTitle);
        } else if (validOrder[validOrder.length - 1] !== goalTitle) {
          const idx = validOrder.indexOf(goalTitle);
          validOrder.splice(idx, 1);
          validOrder.push(goalTitle);
        }

        return {
          learningOrder: validOrder,
          dependencies: parsed.dependencies || [],
          estimatedMinutes: parsed.estimatedMinutes || {},
          knowledgeGaps: parsed.knowledgeGaps || [],
        };
      }
    } catch (e) {
      console.error('Failed to parse LLM response:', e);
    }

    // Fallback: return all notes with goal at end
    const fallbackOrder = availableTitles.filter((t) => t !== goalTitle);
    fallbackOrder.push(goalTitle);
    return {
      learningOrder: fallbackOrder,
      dependencies: [],
      estimatedMinutes: {},
      knowledgeGaps: [],
    };
  }

  private buildDependencyAnalysisPrompt(
    noteContent: string,
    linkedNoteContents: string[]
  ): string {
    const linkedContext = linkedNoteContents
      .map((content, i) => `[연결된 노트 ${i + 1}]\n${content.slice(0, 500)}`)
      .join('\n\n');

    return `다음 노트의 개념적 의존성을 분석해주세요.

[분석 대상 노트]
${noteContent.slice(0, 2000)}

${linkedContext ? `[연결된 노트들]\n${linkedContext}` : ''}

JSON 형식으로 답변:
\`\`\`json
{
  "dependencies": [
    {"source": "개념A", "target": "개념B", "type": "prerequisite", "confidence": 0.8}
  ],
  "concepts": ["추출된 핵심 개념들"],
  "confidence": 0.85
}
\`\`\``;
  }

  private buildKnowledgeGapPrompt(
    pathDescription: string,
    existingConcepts: string[]
  ): string {
    return `학습 경로를 분석하여 지식 갭을 식별해주세요.

[학습 경로]
${pathDescription}

[볼트에 존재하는 개념들]
${existingConcepts.join(', ')}

JSON 형식으로 답변:
\`\`\`json
{
  "gaps": [
    {"concept": "누락된 개념", "reason": "필요한 이유", "priority": "high"}
  ],
  "summary": "분석 요약"
}
\`\`\``;
  }

  private buildLearningOrderPrompt(
    concepts: string[],
    dependencies: DependencyRelation[]
  ): string {
    const depList = dependencies
      .map((d) => `${d.sourceId} → ${d.targetId}`)
      .join('\n');

    return `다음 개념들의 최적 학습 순서를 제안해주세요.

[개념들]
${concepts.join(', ')}

[현재 파악된 의존성]
${depList || '없음'}

JSON 배열로 학습 순서 답변:
\`\`\`json
["첫 번째 학습할 개념", "두 번째", ...]
\`\`\``;
  }

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
              priority: g.priority as 'high' | 'medium' | 'low' || 'medium',
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

  private async callClaude(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }
}
