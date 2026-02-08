/**
 * Google Gemini Embedding Provider
 * Google Generative Language API를 사용한 임베딩 생성
 */

import { requestUrl } from 'obsidian';
import type { IEmbeddingProvider } from '../../core/domain';

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-embedding-001';
const DEFAULT_DIMENSIONS = 3072;

interface GoogleEmbedContentResponse {
  embedding: {
    values: number[];
  };
}

interface GoogleBatchEmbedResponse {
  embeddings: Array<{
    values: number[];
  }>;
}

export class GoogleEmbeddingProvider implements IEmbeddingProvider {
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
    const cleaned = text.trim() || ' ';

    const response = await this.callGoogle<GoogleEmbedContentResponse>(
      `${GOOGLE_API_BASE}/${this.model}:embedContent`,
      {
        content: { parts: [{ text: cleaned }] },
      }
    );

    return response.embedding.values;
  }

  /**
   * 배치 임베딩
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const batchSize = 100;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const cleanedBatch = batch.map((t) => {
        const cleaned = t.trim();
        return cleaned.length > 0 ? cleaned : ' ';
      });

      const requests = cleanedBatch.map((text) => ({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
      }));

      const response = await this.callGoogle<GoogleBatchEmbedResponse>(
        `${GOOGLE_API_BASE}/${this.model}:batchEmbedContents`,
        { requests }
      );

      // Google 배치 응답은 순서 보장됨
      results.push(...response.embeddings.map((e) => e.values));
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
    return 'google';
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
        url: `${GOOGLE_API_BASE}/${this.model}:embedContent`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          content: { parts: [{ text: 'test' }] },
        }),
        throw: false,
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
   * Google API 호출
   */
  private async callGoogle<T>(url: string, body: unknown): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Google API key not configured');
    }

    try {
      const response = await requestUrl({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      });

      if (response.status !== 200) {
        throw new Error(`Google API error: ${response.status}`);
      }

      return response.json as T;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Google embedding failed: ${error.message}`);
      }
      throw error;
    }
  }
}
