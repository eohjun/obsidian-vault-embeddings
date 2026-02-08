/**
 * Embedding Provider Factory
 * 설정 기반 프로바이더 인스턴스 생성
 */

import type { IEmbeddingProvider } from '../../core/domain';
import type { VaultEmbeddingsSettings } from '../../settings/settings';
import { getActiveApiKey, getModelDimensions } from './provider-config';
import { OpenAIEmbeddingProvider } from './openai-embedding-provider';
import { GoogleEmbeddingProvider } from './google-embedding-provider';
import { VoyageAIEmbeddingProvider } from './voyageai-embedding-provider';

/**
 * 현재 설정에 맞는 임베딩 프로바이더 생성
 */
export function createEmbeddingProvider(settings: VaultEmbeddingsSettings): IEmbeddingProvider {
  const apiKey = getActiveApiKey(settings);
  const { provider, model } = settings;
  const dimensions = getModelDimensions(provider, model);

  switch (provider) {
    case 'openai':
      return new OpenAIEmbeddingProvider(apiKey, model, dimensions);
    case 'google':
      return new GoogleEmbeddingProvider(apiKey, model, dimensions);
    case 'voyageai':
      return new VoyageAIEmbeddingProvider(apiKey, model, dimensions);
    default:
      return new OpenAIEmbeddingProvider(apiKey, model, dimensions);
  }
}
