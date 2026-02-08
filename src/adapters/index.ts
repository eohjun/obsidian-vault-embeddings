/**
 * Adapters Layer Exports
 */

// Embedding Providers
export { OpenAIEmbeddingProvider } from './embedding/openai-embedding-provider';
export { GoogleEmbeddingProvider } from './embedding/google-embedding-provider';
export { VoyageAIEmbeddingProvider } from './embedding/voyageai-embedding-provider';

// Provider Factory & Config
export { createEmbeddingProvider } from './embedding/embedding-provider-factory';
export {
  PROVIDER_CONFIGS,
  getModelDimensions,
  getDefaultModel,
  getActiveApiKey,
  getMaxBatchSize,
  type EmbeddingProviderType,
  type ProviderModelConfig,
  type ProviderConfig,
} from './embedding/provider-config';

// Storage
export {
  VaultEmbeddingRepository,
  type VaultEmbeddingRepositoryConfig,
} from './storage/vault-embedding-repository';

// Obsidian
export { ObsidianNoteRepository } from './obsidian/obsidian-note-repository';
