/**
 * EmbeddingService
 * 전체 임베딩 관리 통합 서비스
 */

import type {
  NoteEmbedding,
  IEmbeddingProvider,
  IEmbeddingRepository,
  INoteRepository,
  SearchResult,
  SearchOptions,
} from '../../domain';
import { generateContentHash, isHashEqual } from '../../domain';
import { EmbedNoteUseCase, type EmbedNoteResult } from '../use-cases/embed-note';
import { SearchSimilarUseCase } from '../use-cases/search-similar';

export interface EmbeddingStats {
  totalEmbeddings: number;
  model: string;
  provider: string;
  dimensions: number;
  lastUpdated: string | null;
}

export interface BatchEmbedProgress {
  total: number;
  completed: number;
  skipped: number;
  failed: number;
  currentNote: string | null;
}

export type ProgressCallback = (progress: BatchEmbedProgress) => void;

export class EmbeddingService {
  private embedNoteUseCase: EmbedNoteUseCase;
  private searchSimilarUseCase: SearchSimilarUseCase;

  constructor(
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly embeddingRepository: IEmbeddingRepository,
    private readonly noteRepository: INoteRepository
  ) {
    this.embedNoteUseCase = new EmbedNoteUseCase(
      embeddingProvider,
      embeddingRepository,
      noteRepository
    );
    this.searchSimilarUseCase = new SearchSimilarUseCase(embeddingProvider, embeddingRepository);
  }

  /**
   * 서비스 사용 가능 여부
   */
  isAvailable(): boolean {
    return this.embeddingProvider.isAvailable();
  }

  /**
   * 단일 노트 임베딩
   */
  async embedNote(noteId: string): Promise<EmbedNoteResult> {
    const result = await this.embedNoteUseCase.execute(noteId);
    if (result.wasUpdated) {
      await this.embeddingRepository.updateIndexEntry(result.embedding);
    }
    return result;
  }

  /**
   * 파일 경로로 단일 노트 임베딩 (O(1) 경로 조회)
   */
  async embedNoteByPath(filePath: string): Promise<EmbedNoteResult> {
    const note = await this.noteRepository.findByPath(filePath);
    if (!note) {
      throw new Error(`Note not found at path: ${filePath}`);
    }
    const result = await this.embedNoteUseCase.execute(note.noteId, note);
    if (result.wasUpdated) {
      await this.embeddingRepository.updateIndexEntry(result.embedding);
    }
    return result;
  }

  /**
   * 모든 노트 일괄 임베딩
   */
  async embedAllNotes(
    excludeFolders: string[] = [],
    onProgress?: ProgressCallback
  ): Promise<{ success: number; skipped: number; failed: number }> {
    const notes = await this.noteRepository.findAllExcluding(excludeFolders);

    const progress: BatchEmbedProgress = {
      total: notes.length,
      completed: 0,
      skipped: 0,
      failed: 0,
      currentNote: null,
    };

    for (const note of notes) {
      progress.currentNote = note.path;
      onProgress?.(progress);

      try {
        const result = await this.embedNoteUseCase.execute(note.noteId);
        if (result.reason === 'skipped') {
          progress.skipped++;
        }
        progress.completed++;
      } catch (error) {
        console.error(`Failed to embed ${note.path}:`, error);
        progress.failed++;
      }
    }

    progress.currentNote = null;
    onProgress?.(progress);

    // 인덱스 업데이트
    await this.embeddingRepository.updateIndex();

    return {
      success: progress.completed - progress.skipped,
      skipped: progress.skipped,
      failed: progress.failed,
    };
  }

  /**
   * stale 노트만 재임베딩
   */
  async embedStaleNotes(
    excludeFolders: string[] = [],
    onProgress?: ProgressCallback
  ): Promise<{ updated: number; skipped: number; failed: number }> {
    const notes = await this.noteRepository.findAllExcluding(excludeFolders);

    const progress: BatchEmbedProgress = {
      total: notes.length,
      completed: 0,
      skipped: 0,
      failed: 0,
      currentNote: null,
    };

    let updated = 0;

    for (const note of notes) {
      progress.currentNote = note.path;
      onProgress?.(progress);

      try {
        const currentHash = await generateContentHash(note.content);
        const existingHash = await this.embeddingRepository.getContentHash(note.noteId);

        if (existingHash && isHashEqual(existingHash, currentHash)) {
          progress.skipped++;
        } else {
          await this.embedNoteUseCase.execute(note.noteId);
          updated++;
        }
        progress.completed++;
      } catch (error) {
        console.error(`Failed to embed ${note.path}:`, error);
        progress.failed++;
      }
    }

    progress.currentNote = null;
    onProgress?.(progress);

    await this.embeddingRepository.updateIndex();

    return {
      updated,
      skipped: progress.skipped,
      failed: progress.failed,
    };
  }

  /**
   * 텍스트 쿼리로 유사 노트 검색
   */
  async searchSimilar(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return this.searchSimilarUseCase.execute(query, options);
  }

  /**
   * 특정 노트와 유사한 노트 검색
   */
  async findSimilarToNote(noteId: string, options?: SearchOptions): Promise<SearchResult[]> {
    return this.searchSimilarUseCase.findSimilarToNote(noteId, options);
  }

  /**
   * 임베딩 통계 조회
   */
  async getStats(): Promise<EmbeddingStats> {
    const index = await this.embeddingRepository.getIndex();
    return {
      totalEmbeddings: index.totalNotes,
      model: index.model || this.embeddingProvider.getModel(),
      provider: this.embeddingProvider.getProvider(),
      dimensions: index.dimensions || this.embeddingProvider.getDimensions(),
      lastUpdated: index.lastUpdated || null,
    };
  }

  /**
   * 특정 노트 임베딩 삭제
   */
  async deleteEmbedding(noteId: string): Promise<void> {
    await this.embeddingRepository.delete(noteId);
    await this.embeddingRepository.updateIndex();
  }

  /**
   * 모든 임베딩 삭제
   */
  async clearAllEmbeddings(): Promise<void> {
    await this.embeddingRepository.clear();
  }

  /**
   * 임베딩 존재 여부 확인
   */
  async hasEmbedding(noteId: string): Promise<boolean> {
    return this.embeddingRepository.exists(noteId);
  }

  /**
   * 특정 노트 임베딩 조회
   */
  async getEmbedding(noteId: string): Promise<NoteEmbedding | null> {
    return this.embeddingRepository.findById(noteId);
  }
}
