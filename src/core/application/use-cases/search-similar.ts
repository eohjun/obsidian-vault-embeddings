/**
 * SearchSimilar Use Case
 * 유사 노트 검색
 */

import type {
  IEmbeddingProvider,
  IEmbeddingRepository,
  SearchResult,
  SearchOptions,
} from '../../domain';
import { sortBySimilarity, filterByThreshold, limitResults } from '../../domain';

export class SearchSimilarUseCase {
  constructor(
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly embeddingRepository: IEmbeddingRepository
  ) {}

  /**
   * 텍스트 쿼리로 유사 노트 검색
   */
  async execute(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const {
      limit = 10,
      threshold = 0.3,
      excludeNoteIds = [],
      excludeFolders = [],
    } = options || {};

    // 쿼리 임베딩 생성
    const queryVector = await this.embeddingProvider.embed(query);

    // 모든 임베딩 조회
    const allEmbeddings = await this.embeddingRepository.findAll();

    // 유사도 계산 및 필터링
    const results: SearchResult[] = [];

    for (const embedding of allEmbeddings) {
      // 제외 조건 체크
      if (excludeNoteIds.includes(embedding.noteId)) {
        continue;
      }

      if (excludeFolders.some((folder) => embedding.notePath.startsWith(folder + '/'))) {
        continue;
      }

      // 코사인 유사도 계산
      const similarity = this.cosineSimilarity(queryVector, embedding.vector);

      if (similarity >= threshold) {
        results.push({
          noteId: embedding.noteId,
          notePath: embedding.notePath,
          title: embedding.title,
          similarity,
        });
      }
    }

    // 정렬 및 제한
    const sorted = sortBySimilarity(results);
    return limitResults(sorted, limit);
  }

  /**
   * 특정 노트와 유사한 노트 검색
   */
  async findSimilarToNote(noteId: string, options?: SearchOptions): Promise<SearchResult[]> {
    const embedding = await this.embeddingRepository.findById(noteId);
    if (!embedding) {
      throw new Error(`Embedding not found for note: ${noteId}`);
    }

    const {
      limit = 10,
      threshold = 0.3,
      excludeNoteIds = [],
      excludeFolders = [],
    } = options || {};

    // 자기 자신 제외
    const excludeIds = [...excludeNoteIds, noteId];

    // 모든 임베딩과 비교
    const allEmbeddings = await this.embeddingRepository.findAll();
    const results: SearchResult[] = [];

    for (const other of allEmbeddings) {
      if (excludeIds.includes(other.noteId)) {
        continue;
      }

      if (excludeFolders.some((folder) => other.notePath.startsWith(folder + '/'))) {
        continue;
      }

      const similarity = this.cosineSimilarity(embedding.vector, other.vector);

      if (similarity >= threshold) {
        results.push({
          noteId: other.noteId,
          notePath: other.notePath,
          title: other.title,
          similarity,
        });
      }
    }

    const sorted = sortBySimilarity(results);
    return limitResults(sorted, limit);
  }

  /**
   * 코사인 유사도 계산
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }
}
