# Learning Path Generator

목표 노트까지의 선수 지식을 분석하고 체계적인 학습 경로를 생성하는 AI 기반 Obsidian 플러그인입니다.

## Features

- **선수 지식 분석**: AI가 노트 내용을 분석하여 필요한 선행 개념 파악
- **학습 순서 생성**: Topological Sort 기반 최적 학습 순서 제안
- **지식 갭 식별**: 볼트에 없는 필요한 개념 경고
- **진행 상태 추적**: Mastery Level로 학습 진행도 관리
- **의존성 시각화**: 개념 간 의존 관계를 시각적으로 표시

## PKM Workflow

```
목표 노트 → Learning Path Generator → 학습 경로 (순서화된 노트 목록)
                  (학습 Learn)
```

## Supported AI Providers

| Provider | Model | 특징 |
|----------|-------|------|
| **OpenAI** | GPT-4o, GPT-4o-mini 등 | 정확한 의존성 분석 |
| **Google Gemini** | Gemini 1.5 Pro/Flash | 무료 티어 제공 |
| **Anthropic** | Claude 3.5 Sonnet | 깊은 맥락 이해 |

## Installation

### BRAT (권장)

1. [BRAT](https://github.com/TfTHacker/obsidian42-brat) 플러그인 설치
2. BRAT 설정 열기
3. "Add Beta plugin" 클릭
4. 입력: `eohjun/obsidian-learning-path-generator`
5. 플러그인 활성화

### Manual

1. 최신 릴리스에서 `main.js`, `manifest.json`, `styles.css` 다운로드
2. 폴더 생성: `<vault>/.obsidian/plugins/learning-path-generator/`
3. 다운로드한 파일을 폴더에 복사
4. Obsidian 설정에서 플러그인 활성화

## Dependencies (선택)

- **[Vault Embeddings](https://github.com/eohjun/obsidian-vault-embeddings)**: 의미 기반 선행 지식 검색 (권장)

Vault Embeddings가 설치되어 있으면 임베딩 데이터를 활용하여 더 정확한 의존성 분석이 가능합니다.

## Setup

### API 키 설정

1. Settings → Learning Path Generator 열기
2. **AI Provider** 섹션에서:
   - AI Provider 선택
   - API 키 입력

## Commands

| 명령어 | 설명 |
|--------|------|
| **Generate learning path** | 현재 노트에 대한 학습 경로 생성 |
| **Show learning path** | 생성된 학습 경로 보기 |
| **Update progress** | 학습 진행도 업데이트 |
| **Analyze dependencies** | 노트 의존성 분석 |

## Usage Workflow

```
1. 학습하고 싶은 목표 노트 열기
2. "Generate learning path" 명령 실행
3. AI가 선수 지식 분석 및 학습 순서 생성
4. 학습 경로 패널에서 순서대로 학습
5. 각 노트 학습 후 진행도 업데이트
```

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| AI Provider | 사용할 AI 프로바이더 | OpenAI |
| API Key | 선택한 프로바이더의 API 키 | - |
| Zettelkasten Folder | 노트 폴더 경로 | `04_Zettelkasten` |
| Max depth | 의존성 분석 최대 깊이 | 5 |
| Use embeddings | Vault Embeddings 사용 여부 | true |
| Show gaps | 지식 갭 표시 여부 | true |

## Learning Path Example

```
목표: "분산 시스템 설계"

학습 경로:
1. 📗 네트워크 기초 (mastery: 80%)
2. 📗 TCP/IP 프로토콜 (mastery: 60%)
3. 📙 데이터베이스 기초 (mastery: 40%)
4. 📕 CAP 정리 (mastery: 0%) ← 현재 위치
5. 📕 일관성 모델 (mastery: 0%)
6. ⚠️ 합의 알고리즘 (노트 없음)
7. 📕 분산 시스템 설계 (목표)
```

## Related Plugins

이 플러그인은 다음 플러그인들과 잘 연계됩니다:

- **[Vault Embeddings](https://github.com/eohjun/obsidian-vault-embeddings)**: 의미 기반 선행 지식 검색
- **[Spaced Repetition Scheduler](https://github.com/eohjun/obsidian-spaced-repetition-scheduler)**: 학습 경로 내 노트를 플래시카드로 변환
- **[Evergreen Note Cultivator](https://github.com/eohjun/obsidian-evergreen-note-cultivator)**: 학습 경로 내 노트 품질 일괄 평가
- **[Socratic Challenger](https://github.com/eohjun/obsidian-socratic-challenger)**: 이해 부족 노트에 심화 대화

## Development

```bash
# Install dependencies
npm install

# Development with watch mode
npm run dev

# Production build
npm run build
```

## License

MIT
