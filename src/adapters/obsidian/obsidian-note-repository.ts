/**
 * ObsidianNoteRepository
 * Obsidian Vault에서 노트 조회
 */

import { App, TFile } from 'obsidian';
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
    const file = this.app.vault.getAbstractFileByPath(path);

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

    for (const file of files) {
      if (file.path.startsWith(folderPath + '/')) {
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

    for (const file of files) {
      // 제외 폴더 체크
      const isExcluded = excludedFolders.some(
        (folder) => file.path.startsWith(folder + '/') || file.path === folder
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
   */
  generateNoteId(path: string): string {
    // 경로를 base64로 인코딩하여 안전한 ID 생성
    // .md 확장자 제거 후 인코딩
    const pathWithoutExt = path.replace(/\.md$/, '');
    return this.simpleHash(pathWithoutExt);
  }

  // ==================== Private Methods ====================

  private async fileToNoteContent(file: TFile): Promise<NoteContent | null> {
    try {
      const content = await this.app.vault.cachedRead(file);

      return {
        noteId: this.generateNoteId(file.path),
        path: file.path,
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
