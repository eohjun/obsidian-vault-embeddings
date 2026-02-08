/**
 * EmbedNote Use Case
 * 노트 임베딩 생성 및 저장
 */

import type {
  NoteEmbedding,
  NoteContent,
  IEmbeddingProvider,
  IEmbeddingRepository,
  INoteRepository,
} from '../../domain';
import { createNoteEmbedding, generateContentHash, isHashEqual } from '../../domain';

export interface EmbedNoteResult {
  embedding: NoteEmbedding;
  wasUpdated: boolean;
  reason: 'new' | 'stale' | 'skipped';
}

export class EmbedNoteUseCase {
  constructor(
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly embeddingRepository: IEmbeddingRepository,
    private readonly noteRepository: INoteRepository
  ) {}

  /**
   * 노트 임베딩 생성 (신규 또는 업데이트)
   */
  async execute(noteId: string, preloadedNote?: NoteContent): Promise<EmbedNoteResult> {
    // 노트 내용 조회
    const note = preloadedNote ?? await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // contentHash 계산
    const currentHash = await generateContentHash(note.content);

    // 기존 임베딩 확인
    const existingHash = await this.embeddingRepository.getContentHash(noteId);

    // staleness 체크
    if (existingHash && isHashEqual(existingHash, currentHash)) {
      const existing = await this.embeddingRepository.findById(noteId);
      if (existing) {
        // 프로바이더/모델 변경 확인 — 변경 시 재임베딩 필요
        const currentProvider = this.embeddingProvider.getProvider();
        const currentModel = this.embeddingProvider.getModel();
        if (existing.provider === currentProvider && existing.model === currentModel) {
          return {
            embedding: existing,
            wasUpdated: false,
            reason: 'skipped',
          };
        }
        // 프로바이더/모델 변경 → 아래에서 재임베딩 진행
      }
    }

    // 임베딩 생성
    const vector = await this.embeddingProvider.embed(note.content);

    // NoteEmbedding 엔티티 생성
    const embedding = createNoteEmbedding({
      noteId,
      notePath: note.path,
      title: note.title,
      contentHash: currentHash,
      vector,
      model: this.embeddingProvider.getModel(),
      provider: this.embeddingProvider.getProvider(),
      dimensions: this.embeddingProvider.getDimensions(),
    });

    // 저장
    await this.embeddingRepository.save(embedding);

    return {
      embedding,
      wasUpdated: true,
      reason: existingHash ? 'stale' : 'new',
    };
  }

  /**
   * 조건부 임베딩 (stale인 경우만)
   */
  async embedIfStale(noteId: string, currentHash: string): Promise<NoteEmbedding | null> {
    const existingHash = await this.embeddingRepository.getContentHash(noteId);

    if (existingHash && isHashEqual(existingHash, currentHash)) {
      return null; // 변경 없음
    }

    const result = await this.execute(noteId);
    return result.embedding;
  }

  /**
   * 강제 재임베딩
   */
  async forceEmbed(noteId: string): Promise<NoteEmbedding> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const currentHash = await generateContentHash(note.content);
    const vector = await this.embeddingProvider.embed(note.content);

    const embedding = createNoteEmbedding({
      noteId,
      notePath: note.path,
      title: note.title,
      contentHash: currentHash,
      vector,
      model: this.embeddingProvider.getModel(),
      provider: this.embeddingProvider.getProvider(),
      dimensions: this.embeddingProvider.getDimensions(),
    });

    await this.embeddingRepository.save(embedding);
    return embedding;
  }
}
