/**
 * IEmbeddingRepository Interface
 * 임베딩 데이터 저장소 인터페이스
 */

import type { NoteEmbedding } from '../entities/note-embedding';

export interface EmbeddingIndex {
  version: string;
  totalNotes: number;
  lastUpdated: string;
  model: string;
  dimensions: number;
  notes: Record<string, {
    path: string;
    contentHash: string;
    updatedAt: string;
  }>;
}

export interface IEmbeddingRepository {
  /**
   * 임베딩 저장
   * @param embedding 저장할 임베딩
   */
  save(embedding: NoteEmbedding): Promise<void>;

  /**
   * 여러 임베딩 일괄 저장
   * @param embeddings 저장할 임베딩 배열
   */
  saveBatch(embeddings: NoteEmbedding[]): Promise<void>;

  /**
   * ID로 임베딩 조회
   * @param noteId 노트 ID
   */
  findById(noteId: string): Promise<NoteEmbedding | null>;

  /**
   * 파일 경로로 임베딩 조회
   * @param notePath 파일 경로
   */
  findByPath(notePath: string): Promise<NoteEmbedding | null>;

  /**
   * 모든 임베딩 조회
   */
  findAll(): Promise<NoteEmbedding[]>;

  /**
   * 임베딩 삭제
   * @param noteId 노트 ID
   */
  delete(noteId: string): Promise<void>;

  /**
   * 임베딩 존재 여부 확인
   * @param noteId 노트 ID
   */
  exists(noteId: string): Promise<boolean>;

  /**
   * 저장된 contentHash 조회 (staleness 체크용)
   * @param noteId 노트 ID
   */
  getContentHash(noteId: string): Promise<string | null>;

  /**
   * 인덱스 파일 업데이트
   */
  updateIndex(): Promise<void>;

  /**
   * 인덱스 조회
   */
  getIndex(): Promise<EmbeddingIndex>;

  /**
   * 저장된 임베딩 수
   */
  count(): Promise<number>;

  /**
   * 모든 임베딩 삭제
   */
  clear(): Promise<void>;

  /**
   * 저장소 초기화 (폴더 생성 등)
   */
  initialize(): Promise<void>;
}
