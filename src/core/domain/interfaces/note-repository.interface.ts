/**
 * INoteRepository Interface
 * 노트 조회 인터페이스
 */

export interface NoteContent {
  /** 노트 ID */
  noteId: string;

  /** 파일 경로 */
  path: string;

  /** 노트 제목 */
  title: string;

  /** 노트 내용 (마크다운) */
  content: string;

  /** 마지막 수정 시각 */
  modifiedAt: Date;
}

export interface INoteRepository {
  /**
   * ID로 노트 조회
   * @param noteId 노트 ID
   */
  findById(noteId: string): Promise<NoteContent | null>;

  /**
   * 파일 경로로 노트 조회
   * @param path 파일 경로
   */
  findByPath(path: string): Promise<NoteContent | null>;

  /**
   * 모든 마크다운 노트 조회
   */
  findAllMarkdownNotes(): Promise<NoteContent[]>;

  /**
   * 특정 폴더의 노트 조회
   * @param folderPath 폴더 경로
   */
  findByFolder(folderPath: string): Promise<NoteContent[]>;

  /**
   * 제외 폴더를 제외한 모든 노트 조회
   * @param excludedFolders 제외할 폴더 경로 배열
   */
  findAllExcluding(excludedFolders: string[]): Promise<NoteContent[]>;

  /**
   * 노트 존재 여부 확인
   * @param noteId 노트 ID
   */
  exists(noteId: string): Promise<boolean>;

  /**
   * 파일 경로로 노트 ID 생성
   * @param path 파일 경로
   */
  generateNoteId(path: string): string;
}
