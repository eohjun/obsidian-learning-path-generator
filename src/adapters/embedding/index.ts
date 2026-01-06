/**
 * Embedding Adapters
 *
 * Vault Embeddings 플러그인을 활용한 임베딩 어댑터 모음.
 * 노트 임베딩은 Vault Embeddings가 담당하고,
 * 이 플러그인은 쿼리 임베딩 생성 및 유사도 검색만 수행.
 */

export { OpenAIEmbeddingProvider } from './openai-embedding-provider';
export { InMemoryVectorStore } from './in-memory-vector-store';
export { VaultEmbeddingsVectorStore, type VaultEmbeddingsVectorStoreConfig } from './vault-embeddings-vector-store';
export { StandaloneSemanticSearchAdapter } from './standalone-semantic-search-adapter';
