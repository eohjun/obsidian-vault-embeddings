/**
 * SearchResult Value Object
 * 유사도 검색 결과
 */

export interface SearchResult {
  /** 노트 ID */
  noteId: string;

  /** 파일 경로 */
  notePath: string;

  /** 노트 제목 */
  title: string;

  /** 유사도 점수 (0.0 ~ 1.0) */
  similarity: number;
}

export interface SearchOptions {
  /** 최대 결과 수 */
  limit?: number;

  /** 최소 유사도 임계값 */
  threshold?: number;

  /** 제외할 노트 ID 목록 */
  excludeNoteIds?: string[];

  /** 제외할 폴더 경로 목록 */
  excludeFolders?: string[];
}

/**
 * 유사도로 결과 정렬
 */
export function sortBySimilarity(results: SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => b.similarity - a.similarity);
}

/**
 * 임계값 이상 결과만 필터링
 */
export function filterByThreshold(
  results: SearchResult[],
  threshold: number
): SearchResult[] {
  return results.filter((r) => r.similarity >= threshold);
}

/**
 * 결과 수 제한
 */
export function limitResults(results: SearchResult[], limit: number): SearchResult[] {
  return results.slice(0, limit);
}
