# Learning Path Generator

An AI-powered Obsidian plugin that analyzes prerequisite knowledge and generates systematic learning paths to reach your target notes.

## Features

- **Prerequisite Analysis**: AI analyzes note content to identify required prior concepts
- **Learning Order Generation**: Topological sort-based optimal learning sequence
- **Knowledge Gap Identification**: Warns about concepts missing from your vault
- **Progress Tracking**: Manage learning progress with mastery levels
- **Dependency Visualization**: Visual display of concept dependencies

## PKM Workflow

```
Target Note → Learning Path Generator → Learning Path (Ordered Note List)
                     (Learn)
```

## Supported AI Providers

| Provider | Model | Notes |
|----------|-------|-------|
| **OpenAI** | GPT-4o, GPT-4o-mini | Accurate dependency analysis |
| **Google Gemini** | Gemini 1.5 Pro/Flash | Free tier available |
| **Anthropic** | Claude 3.5 Sonnet | Deep context understanding |

## Installation

### BRAT (Recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Open BRAT settings
3. Click "Add Beta plugin"
4. Enter: `eohjun/obsidian-learning-path-generator`
5. Enable the plugin

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from the latest release
2. Create folder: `<vault>/.obsidian/plugins/learning-path-generator/`
3. Copy downloaded files to the folder
4. Enable the plugin in Obsidian settings

## Dependencies (Optional)

- **[Vault Embeddings](https://github.com/eohjun/obsidian-vault-embeddings)**: Semantic-based prerequisite search (recommended)

With Vault Embeddings installed, more accurate dependency analysis is possible using embedding data.

## Setup

### API Key Configuration

1. Open Settings → Learning Path Generator
2. In **AI Provider** section:
   - Select AI Provider
   - Enter API key

## Commands

| Command | Description |
|---------|-------------|
| **Generate learning path** | Generate learning path for current note |
| **Show learning path** | View generated learning path |
| **Update progress** | Update learning progress |
| **Analyze dependencies** | Analyze note dependencies |

## Usage Workflow

```
1. Open the target note you want to learn
2. Run "Generate learning path" command
3. AI analyzes prerequisites and generates learning order
4. Follow the path in the learning path panel
5. Update progress after studying each note
```

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| AI Provider | AI provider to use | OpenAI |
| API Key | API key for selected provider | - |
| Zettelkasten Folder | Note folder path | `04_Zettelkasten` |
| Max depth | Maximum dependency analysis depth | 5 |
| Use embeddings | Use Vault Embeddings | true |
| Show gaps | Show knowledge gaps | true |

## Learning Path Example

```
Goal: "Distributed Systems Design"

Learning Path:
1. 📗 Network Fundamentals (mastery: 80%)
2. 📗 TCP/IP Protocol (mastery: 60%)
3. 📙 Database Fundamentals (mastery: 40%)
4. 📕 CAP Theorem (mastery: 0%) ← Current position
5. 📕 Consistency Models (mastery: 0%)
6. ⚠️ Consensus Algorithms (note missing)
7. 📕 Distributed Systems Design (goal)
```

## Related Plugins

This plugin works well with:

- **[Vault Embeddings](https://github.com/eohjun/obsidian-vault-embeddings)**: Semantic-based prerequisite search
- **[Spaced Repetition Scheduler](https://github.com/eohjun/obsidian-spaced-repetition-scheduler)**: Convert learning path notes to flashcards
- **[Evergreen Note Cultivator](https://github.com/eohjun/obsidian-evergreen-note-cultivator)**: Batch evaluate note quality in learning path
- **[Socratic Challenger](https://github.com/eohjun/obsidian-socratic-challenger)**: Deepen understanding of challenging notes

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
