/**
 * ObsidianNoteRepository
 * Obsidian Vault에서 노트 조회
 */

import { App, TFile, normalizePath } from 'obsidian';
import type { INoteRepository, NoteContent } from '../../core/domain';

export class ObsidianNoteRepository implements INoteRepository {
  constructor(private app: App) {}

  /**
   * ID로 노트 조회
   */
  async findById(noteId: string): Promise<NoteContent | null> {
    // noteId는 파일 경로 기반이므로 역변환
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      if (this.generateNoteId(file.path) === noteId) {
        return this.fileToNoteContent(file);
      }
    }

    return null;
  }

  /**
   * 파일 경로로 노트 조회
   */
  async findByPath(path: string): Promise<NoteContent | null> {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (!(file instanceof TFile)) {
      return null;
    }

    return this.fileToNoteContent(file);
  }

  /**
   * 모든 마크다운 노트 조회
   */
  async findAllMarkdownNotes(): Promise<NoteContent[]> {
    const files = this.app.vault.getMarkdownFiles();
    const notes: NoteContent[] = [];

    for (const file of files) {
      const note = await this.fileToNoteContent(file);
      if (note) {
        notes.push(note);
      }
    }

    return notes;
  }

  /**
   * 특정 폴더의 노트 조회
   */
  async findByFolder(folderPath: string): Promise<NoteContent[]> {
    const files = this.app.vault.getMarkdownFiles();
    const notes: NoteContent[] = [];
    const normalizedFolder = normalizePath(folderPath);

    for (const file of files) {
      const normalizedFilePath = normalizePath(file.path);
      if (normalizedFilePath.startsWith(normalizedFolder + '/')) {
        const note = await this.fileToNoteContent(file);
        if (note) {
          notes.push(note);
        }
      }
    }

    return notes;
  }

  /**
   * 제외 폴더를 제외한 모든 노트 조회
   */
  async findAllExcluding(excludedFolders: string[]): Promise<NoteContent[]> {
    const files = this.app.vault.getMarkdownFiles();
    const notes: NoteContent[] = [];
    const normalizedExcluded = excludedFolders.map(f => normalizePath(f));

    for (const file of files) {
      const normalizedFilePath = normalizePath(file.path);
      // 제외 폴더 체크
      const isExcluded = normalizedExcluded.some(
        (folder) => normalizedFilePath.startsWith(folder + '/') || normalizedFilePath === folder
      );

      if (!isExcluded) {
        const note = await this.fileToNoteContent(file);
        if (note) {
          notes.push(note);
        }
      }
    }

    return notes;
  }

  /**
   * 노트 존재 여부 확인
   */
  async exists(noteId: string): Promise<boolean> {
    const note = await this.findById(noteId);
    return note !== null;
  }

  /**
   * 파일 경로로 노트 ID 생성
   * 안정적이고 예측 가능한 ID 생성
   * 크로스 플랫폼 호환성을 위해 경로를 정규화
   */
  generateNoteId(path: string): string {
    // 경로 정규화 후 .md 확장자 제거
    const normalizedPath = normalizePath(path);
    const pathWithoutExt = normalizedPath.replace(/\.md$/, '');
    return this.simpleHash(pathWithoutExt);
  }

  // ==================== Private Methods ====================

  private async fileToNoteContent(file: TFile): Promise<NoteContent | null> {
    try {
      const content = await this.app.vault.cachedRead(file);
      const normalizedPath = normalizePath(file.path);

      return {
        noteId: this.generateNoteId(file.path),
        path: normalizedPath,
        title: file.basename,
        content,
        modifiedAt: new Date(file.stat.mtime),
      };
    } catch {
      return null;
    }
  }

  /**
   * 간단한 해시 함수로 ID 생성
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
