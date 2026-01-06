/**
 * Domain Layer Exports
 */

// Entities
export type {
  NoteEmbedding,
  SerializedNoteEmbedding,
} from './entities/note-embedding';
export {
  createNoteEmbedding,
  serializeNoteEmbedding,
  deserializeNoteEmbedding,
} from './entities/note-embedding';

// Interfaces
export type { IEmbeddingProvider } from './interfaces/embedding-provider.interface';
export type {
  IEmbeddingRepository,
  EmbeddingIndex,
} from './interfaces/embedding-repository.interface';
export type {
  INoteRepository,
  NoteContent,
} from './interfaces/note-repository.interface';

// Value Objects
export type { SearchResult, SearchOptions } from './value-objects/search-result';
export {
  sortBySimilarity,
  filterByThreshold,
  limitResults,
} from './value-objects/search-result';
export {
  generateContentHash,
  isHashEqual,
  getHashAlgorithm,
} from './value-objects/content-hash';
