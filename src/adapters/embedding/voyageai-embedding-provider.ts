/**
 * Voyage AI Embedding Provider
 * Voyage AI API를 사용한 임베딩 생성
 */

import { requestUrl } from 'obsidian';
import type { IEmbeddingProvider } from '../../core/domain';

const VOYAGEAI_API_URL = 'https://api.voyageai.com/v1/embeddings';
const DEFAULT_MODEL = 'voyage-3.5-lite';
const DEFAULT_DIMENSIONS = 1024;

interface VoyageAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage: {
    total_tokens: number;
  };
}

export class VoyageAIEmbeddingProvider implements IEmbeddingProvider {
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
    const response = await this.callVoyageAI([text]);
    return response.data[0].embedding;
  }

  /**
   * 배치 임베딩
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const batchSize = 128;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await this.callVoyageAI(batch);

      // Voyage AI 응답은 순서 비보장 — index로 정렬
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
    return 'voyageai';
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
        url: VOYAGEAI_API_URL,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: ['test'],
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
   * Voyage AI API 호출
   */
  private async callVoyageAI(texts: string[]): Promise<VoyageAIEmbeddingResponse> {
    if (!this.apiKey) {
      throw new Error('Voyage AI API key not configured');
    }

    // 빈 텍스트 필터링 및 정리
    const cleanedTexts = texts.map((t) => {
      const cleaned = t.trim();
      return cleaned.length > 0 ? cleaned : ' ';
    });

    try {
      const response = await requestUrl({
        url: VOYAGEAI_API_URL,
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
        throw new Error(`Voyage AI API error: ${response.status}`);
      }

      return response.json as VoyageAIEmbeddingResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Voyage AI embedding failed: ${error.message}`);
      }
      throw error;
    }
  }
}
