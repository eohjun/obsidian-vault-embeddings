/**
 * VaultEmbeddingRepository
 * 볼트 폴더에 임베딩 데이터 저장
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import type {
  NoteEmbedding,
  IEmbeddingRepository,
  EmbeddingIndex,
} from '../../core/domain';
import {
  serializeNoteEmbedding,
  deserializeNoteEmbedding,
} from '../../core/domain';

const INDEX_VERSION = '1.0.0';

export interface VaultEmbeddingRepositoryConfig {
  /** 임베딩 저장 폴더 (기본: 09_Embedded) */
  storagePath: string;
  /** 임베딩 파일 폴더 (기본: embeddings) */
  embeddingsFolder: string;
}

const DEFAULT_CONFIG: VaultEmbeddingRepositoryConfig = {
  storagePath: '09_Embedded',
  embeddingsFolder: 'embeddings',
};

export class VaultEmbeddingRepository implements IEmbeddingRepository {
  private config: VaultEmbeddingRepositoryConfig;
  private indexCache: EmbeddingIndex | null = null;

  constructor(
    private app: App,
    config?: Partial<VaultEmbeddingRepositoryConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 저장소 초기화 (폴더 생성)
   */
  async initialize(): Promise<void> {
    const basePath = normalizePath(this.config.storagePath);
    const embeddingsPath = normalizePath(`${basePath}/${this.config.embeddingsFolder}`);

    // 기본 폴더 생성
    await this.ensureFolder(basePath);
    await this.ensureFolder(embeddingsPath);

    // 인덱스 파일 초기화
    const indexPath = this.getIndexPath();
    if (!await this.fileExists(indexPath)) {
      await this.saveIndex(this.createEmptyIndex());
    }
  }

  /**
   * 임베딩 저장
   */
  async save(embedding: NoteEmbedding): Promise<void> {
    const filePath = this.getEmbeddingPath(embedding.noteId);
    const serialized = serializeNoteEmbedding(embedding);
    const content = JSON.stringify(serialized, null, 2);

    await this.writeFile(filePath, content);
    this.invalidateIndexCache();
  }

  /**
   * 여러 임베딩 일괄 저장
   */
  async saveBatch(embeddings: NoteEmbedding[]): Promise<void> {
    for (const embedding of embeddings) {
      await this.save(embedding);
    }
  }

  /**
   * ID로 임베딩 조회
   */
  async findById(noteId: string): Promise<NoteEmbedding | null> {
    const filePath = this.getEmbeddingPath(noteId);

    if (!await this.fileExists(filePath)) {
      return null;
    }

    try {
      const content = await this.readFile(filePath);
      const data = JSON.parse(content);
      return deserializeNoteEmbedding(data);
    } catch {
      return null;
    }
  }

  /**
   * 파일 경로로 임베딩 조회
   */
  async findByPath(notePath: string): Promise<NoteEmbedding | null> {
    const index = await this.getIndex();

    for (const [noteId, info] of Object.entries(index.notes)) {
      if (info.path === notePath) {
        return this.findById(noteId);
      }
    }

    return null;
  }

  /**
   * 모든 임베딩 조회
   */
  async findAll(): Promise<NoteEmbedding[]> {
    const index = await this.getIndex();
    const embeddings: NoteEmbedding[] = [];

    for (const noteId of Object.keys(index.notes)) {
      const embedding = await this.findById(noteId);
      if (embedding) {
        embeddings.push(embedding);
      }
    }

    return embeddings;
  }

  /**
   * 임베딩 삭제
   */
  async delete(noteId: string): Promise<void> {
    const filePath = this.getEmbeddingPath(noteId);
    await this.deleteFile(filePath);
    this.invalidateIndexCache();
  }

  /**
   * 임베딩 존재 여부 확인
   */
  async exists(noteId: string): Promise<boolean> {
    const filePath = this.getEmbeddingPath(noteId);
    return this.fileExists(filePath);
  }

  /**
   * contentHash 조회
   */
  async getContentHash(noteId: string): Promise<string | null> {
    const index = await this.getIndex();
    return index.notes[noteId]?.contentHash || null;
  }

  /**
   * 인덱스 업데이트
   */
  async updateIndex(): Promise<void> {
    const embeddingsPath = normalizePath(`${this.config.storagePath}/${this.config.embeddingsFolder}`);
    const folder = this.app.vault.getAbstractFileByPath(embeddingsPath);

    if (!(folder instanceof TFolder)) {
      await this.saveIndex(this.createEmptyIndex());
      return;
    }

    const notes: EmbeddingIndex['notes'] = {};
    let model = '';
    let dimensions = 0;

    for (const file of folder.children) {
      if (file instanceof TFile && file.extension === 'json') {
        try {
          const content = await this.app.vault.read(file);
          const embedding = deserializeNoteEmbedding(JSON.parse(content));

          notes[embedding.noteId] = {
            path: embedding.notePath,
            contentHash: embedding.contentHash,
            updatedAt: embedding.updatedAt.toISOString(),
          };

          if (!model) model = embedding.model;
          if (!dimensions) dimensions = embedding.dimensions;
        } catch {
          // 파싱 실패한 파일 무시
        }
      }
    }

    const index: EmbeddingIndex = {
      version: INDEX_VERSION,
      totalNotes: Object.keys(notes).length,
      lastUpdated: new Date().toISOString(),
      model,
      dimensions,
      notes,
    };

    await this.saveIndex(index);
  }

  /**
   * 인덱스 조회
   */
  async getIndex(): Promise<EmbeddingIndex> {
    if (this.indexCache) {
      return this.indexCache;
    }

    const indexPath = this.getIndexPath();

    if (!await this.fileExists(indexPath)) {
      const emptyIndex = this.createEmptyIndex();
      this.indexCache = emptyIndex;
      return emptyIndex;
    }

    try {
      const content = await this.readFile(indexPath);
      const index = JSON.parse(content) as EmbeddingIndex;
      this.indexCache = index;
      return index;
    } catch {
      const emptyIndex = this.createEmptyIndex();
      this.indexCache = emptyIndex;
      return emptyIndex;
    }
  }

  /**
   * 저장된 임베딩 수
   */
  async count(): Promise<number> {
    const index = await this.getIndex();
    return index.totalNotes;
  }

  /**
   * 모든 임베딩 삭제
   */
  async clear(): Promise<void> {
    const embeddingsPath = normalizePath(`${this.config.storagePath}/${this.config.embeddingsFolder}`);
    const folder = this.app.vault.getAbstractFileByPath(embeddingsPath);

    if (folder instanceof TFolder) {
      for (const file of folder.children) {
        if (file instanceof TFile) {
          await this.app.vault.delete(file);
        }
      }
    }

    await this.saveIndex(this.createEmptyIndex());
  }

  // ==================== Private Methods ====================

  private getIndexPath(): string {
    return normalizePath(`${this.config.storagePath}/index.json`);
  }

  private getEmbeddingPath(noteId: string): string {
    // noteId를 안전한 파일명으로 변환
    const safeId = noteId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return normalizePath(`${this.config.storagePath}/${this.config.embeddingsFolder}/${safeId}.json`);
  }

  private createEmptyIndex(): EmbeddingIndex {
    return {
      version: INDEX_VERSION,
      totalNotes: 0,
      lastUpdated: new Date().toISOString(),
      model: '',
      dimensions: 0,
      notes: {},
    };
  }

  private async saveIndex(index: EmbeddingIndex): Promise<void> {
    const indexPath = this.getIndexPath();
    const content = JSON.stringify(index, null, 2);
    await this.writeFile(indexPath, content);
    this.indexCache = index;
  }

  private invalidateIndexCache(): void {
    this.indexCache = null;
  }

  /**
   * 폴더 존재 확인 및 생성 (robust 버전)
   * - 이미 폴더가 존재하면 아무것도 안 함
   * - 폴더가 없으면 생성
   * - "Folder already exists" 에러는 성공으로 처리 (Git 동기화 시 인덱스 불일치 대응)
   */
  private async ensureFolder(path: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);

    // 이미 폴더로 존재
    if (existing instanceof TFolder) {
      return;
    }

    // 파일로 존재하면 에러 (폴더여야 함)
    if (existing instanceof TFile) {
      throw new Error(`Path exists as file, expected folder: ${path}`);
    }

    // 존재하지 않으면 생성 시도
    try {
      await this.app.vault.createFolder(path);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // "Folder already exists" 에러는 성공으로 처리
      // Git 동기화 후 Obsidian 인덱스가 아직 갱신되지 않은 경우 발생
      if (errorMsg.toLowerCase().includes('already exists') ||
          errorMsg.toLowerCase().includes('folder already exists')) {
        console.log(`Vault Embeddings: Folder already exists (sync OK): ${path}`);
        return;
      }

      // 다른 에러의 경우 재확인 시도
      await this.delay(100);

      const recheckExisting = this.app.vault.getAbstractFileByPath(path);
      if (recheckExisting instanceof TFolder) {
        console.log(`Vault Embeddings: Folder exists after retry: ${path}`);
        return;
      }

      // 여전히 없으면 에러
      throw new Error(`Failed to create folder: ${path} - ${errorMsg}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fileExists(path: string): Promise<boolean> {
    // Obsidian 인덱스 먼저 확인
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      return true;
    }

    // 인덱스에 없어도 실제 파일 시스템에 있을 수 있음 (Git 동기화)
    try {
      return await this.app.vault.adapter.exists(path);
    } catch {
      return false;
    }
  }

  private async readFile(path: string): Promise<string> {
    // Obsidian 인덱스 먼저 확인
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      return this.app.vault.read(file);
    }

    // 인덱스에 없어도 adapter로 직접 읽기 시도 (Git 동기화 대응)
    try {
      const content = await this.app.vault.adapter.read(path);
      console.log(`Vault Embeddings: Used adapter.read for: ${path}`);
      return content;
    } catch {
      throw new Error(`File not found: ${path}`);
    }
  }

  private async writeFile(path: string, content: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
      return;
    }

    // 파일이 인덱스에 없으면 생성 시도
    try {
      await this.app.vault.create(path, content);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // "File already exists" 에러 → 인덱스 갱신 대기 후 modify 시도
      if (errorMsg.toLowerCase().includes('already exists') ||
          errorMsg.toLowerCase().includes('file already exists')) {
        console.log(`Vault Embeddings: File already exists, retrying with modify: ${path}`);
        await this.delay(100);

        const retryFile = this.app.vault.getAbstractFileByPath(path);
        if (retryFile instanceof TFile) {
          await this.app.vault.modify(retryFile, content);
          return;
        }

        // 여전히 인덱스에 없으면 adapter 직접 사용
        // Obsidian의 low-level adapter로 직접 쓰기
        await this.app.vault.adapter.write(path, content);
        console.log(`Vault Embeddings: Used adapter.write for: ${path}`);
        return;
      }

      throw error;
    }
  }

  private async deleteFile(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.app.vault.delete(file);
    }
  }
}
