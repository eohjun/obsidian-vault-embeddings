/**
 * NoteEmbedding Entity
 * 노트 임베딩 핵심 엔티티
 */

export interface NoteEmbedding {
  /** 노트 고유 ID (파일 경로 기반 해시 또는 UUID) */
  noteId: string;

  /** 볼트 내 파일 경로 */
  notePath: string;

  /** 노트 제목 */
  title: string;

  /** 내용 해시 (staleness 감지용) */
  contentHash: string;

  /** 임베딩 벡터 */
  vector: number[];

  /** 사용된 모델 */
  model: string;

  /** 임베딩 프로바이더 */
  provider: string;

  /** 벡터 차원 수 */
  dimensions: number;

  /** 생성 시각 */
  createdAt: Date;

  /** 마지막 업데이트 시각 */
  updatedAt: Date;
}

/**
 * 파일 저장용 직렬화 형식
 */
export interface SerializedNoteEmbedding {
  noteId: string;
  notePath: string;
  title: string;
  contentHash: string;
  vector: number[];
  model: string;
  provider: string;
  dimensions: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * NoteEmbedding 생성 헬퍼
 */
export function createNoteEmbedding(
  params: Omit<NoteEmbedding, 'createdAt' | 'updatedAt'>
): NoteEmbedding {
  const now = new Date();
  return {
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 직렬화
 */
export function serializeNoteEmbedding(embedding: NoteEmbedding): SerializedNoteEmbedding {
  return {
    ...embedding,
    createdAt: embedding.createdAt.toISOString(),
    updatedAt: embedding.updatedAt.toISOString(),
  };
}

/**
 * 역직렬화
 */
export function deserializeNoteEmbedding(data: SerializedNoteEmbedding): NoteEmbedding {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}
