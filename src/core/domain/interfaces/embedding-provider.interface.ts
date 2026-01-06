/**
 * IEmbeddingProvider Interface
 * 임베딩 생성 프로바이더 인터페이스 (OpenAI, Gemini 등)
 */

export interface IEmbeddingProvider {
  /**
   * 단일 텍스트를 벡터로 변환
   * @param text 임베딩할 텍스트
   * @returns 임베딩 벡터
   */
  embed(text: string): Promise<number[]>;

  /**
   * 여러 텍스트를 배치로 벡터 변환
   * @param texts 임베딩할 텍스트 배열
   * @returns 임베딩 벡터 배열
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * 프로바이더 사용 가능 여부
   * @returns API 키 설정 등으로 사용 가능한지 여부
   */
  isAvailable(): boolean;

  /**
   * 사용 중인 모델명
   */
  getModel(): string;

  /**
   * 프로바이더 이름
   */
  getProvider(): string;

  /**
   * 벡터 차원 수
   */
  getDimensions(): number;

  /**
   * API 키 유효성 테스트
   * @param apiKey 테스트할 API 키
   */
  testApiKey(apiKey: string): Promise<boolean>;
}
