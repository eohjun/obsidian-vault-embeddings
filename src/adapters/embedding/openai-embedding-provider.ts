/**
 * OpenAI Embedding Provider
 * OpenAI API를 사용한 임베딩 생성
 */

import { requestUrl } from 'obsidian';
import type { IEmbeddingProvider } from '../../core/domain';

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private model: string;
  private dimensions: number;

  constructor(
    private apiKey: string,
    model: string = DEFAULT_MODEL,
    dimensions: number = DEFAULT_DIMENSIONS
  ) {
    this.model = model;
    this.dimensions = dimensions;
  }

  /**
   * 단일 텍스트 임베딩
   */
  async embed(text: string): Promise<number[]> {
    const response = await this.callOpenAI([text]);
    return response.data[0].embedding;
  }

  /**
   * 배치 임베딩
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    // OpenAI는 배치 처리 지원 (최대 2048개)
    const batchSize = 100;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await this.callOpenAI(batch);

      // 인덱스 순서대로 정렬
      const sorted = response.data.sort((a, b) => a.index - b.index);
      results.push(...sorted.map((d) => d.embedding));
    }

    return results;
  }

  /**
   * 프로바이더 사용 가능 여부
   */
  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * 사용 중인 모델명
   */
  getModel(): string {
    return this.model;
  }

  /**
   * 프로바이더 이름
   */
  getProvider(): string {
    return 'openai';
  }

  /**
   * 벡터 차원 수
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * API 키 유효성 테스트
   */
  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await requestUrl({
        url: OPENAI_API_URL,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: 'test',
        }),
      });

      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * API 키 업데이트
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * OpenAI API 호출
   */
  private async callOpenAI(texts: string[]): Promise<OpenAIEmbeddingResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // 빈 텍스트 필터링 및 정리
    const cleanedTexts = texts.map((t) => {
      const cleaned = t.trim();
      return cleaned.length > 0 ? cleaned : ' '; // 빈 문자열 방지
    });

    try {
      const response = await requestUrl({
        url: OPENAI_API_URL,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: cleanedTexts,
        }),
      });

      if (response.status !== 200) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      return response.json as OpenAIEmbeddingResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI embedding failed: ${error.message}`);
      }
      throw error;
    }
  }
}
