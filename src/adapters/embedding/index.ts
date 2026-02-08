/**
 * Embedding Adapters
 *
 * Collection of embedding adapters utilizing Vault Embeddings plugin.
 * Note embeddings are handled by Vault Embeddings,
 * this plugin only generates query embeddings and performs similarity search.
 */

export { OpenAIEmbeddingProvider } from './openai-embedding-provider';
export { VaultEmbeddingsQueryProvider } from './vault-embeddings-query-provider';
export { InMemoryVectorStore } from './in-memory-vector-store';
export { VaultEmbeddingsVectorStore, type VaultEmbeddingsVectorStoreConfig } from './vault-embeddings-vector-store';
export { StandaloneSemanticSearchAdapter } from './standalone-semantic-search-adapter';
