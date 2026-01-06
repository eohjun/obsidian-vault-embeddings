/**
 * Adapters Layer Exports
 */

// Embedding
export { OpenAIEmbeddingProvider } from './embedding/openai-embedding-provider';

// Storage
export {
  VaultEmbeddingRepository,
  type VaultEmbeddingRepositoryConfig,
} from './storage/vault-embedding-repository';

// Obsidian
export { ObsidianNoteRepository } from './obsidian/obsidian-note-repository';
