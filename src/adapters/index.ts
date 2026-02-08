// Repositories
export {
  NoteRepository,
  PathRepository,
  ProgressRepository,
  type PathRepositoryConfig,
  type ProgressRepositoryConfig,
} from './repositories';

// LLM Providers
export {
  BaseProvider,
  ClaudeProvider,
  OpenAIProvider,
  GeminiProvider,
  GrokProvider,
} from './llm';

// Embedding Adapters (Vault Embeddings Integration)
export {
  OpenAIEmbeddingProvider,
  VaultEmbeddingsQueryProvider,
  InMemoryVectorStore,
  VaultEmbeddingsVectorStore,
  StandaloneSemanticSearchAdapter,
  type VaultEmbeddingsVectorStoreConfig,
} from './embedding';
