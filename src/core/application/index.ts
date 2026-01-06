/**
 * Application Layer Exports
 */

// Use Cases
export { EmbedNoteUseCase, type EmbedNoteResult } from './use-cases/embed-note';
export { SearchSimilarUseCase } from './use-cases/search-similar';

// Services
export {
  EmbeddingService,
  type EmbeddingStats,
  type BatchEmbedProgress,
  type ProgressCallback,
} from './services/embedding-service';
