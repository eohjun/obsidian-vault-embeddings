/**
 * Provider Configuration Registry
 * 프로바이더/모델 설정 중앙 관리
 */

import type { VaultEmbeddingsSettings } from '../../settings/settings';

export type EmbeddingProviderType = 'openai' | 'google' | 'voyageai';

export interface ProviderModelConfig {
  id: string;
  name: string;
  dimensions: number;
  maxBatchSize: number;
}

export interface ProviderConfig {
  type: EmbeddingProviderType;
  name: string;
  models: ProviderModelConfig[];
  defaultModel: string;
  apiKeyPlaceholder: string;
}

export const PROVIDER_CONFIGS: Record<EmbeddingProviderType, ProviderConfig> = {
  openai: {
    type: 'openai',
    name: 'OpenAI',
    defaultModel: 'text-embedding-3-small',
    apiKeyPlaceholder: 'sk-...',
    models: [
      { id: 'text-embedding-3-small', name: 'text-embedding-3-small (1536d)', dimensions: 1536, maxBatchSize: 100 },
      { id: 'text-embedding-3-large', name: 'text-embedding-3-large (3072d)', dimensions: 3072, maxBatchSize: 100 },
    ],
  },
  google: {
    type: 'google',
    name: 'Google (Gemini)',
    defaultModel: 'gemini-embedding-001',
    apiKeyPlaceholder: 'AIza...',
    models: [
      { id: 'gemini-embedding-001', name: 'gemini-embedding-001 (3072d)', dimensions: 3072, maxBatchSize: 100 },
      { id: 'text-embedding-004', name: 'text-embedding-004 (768d)', dimensions: 768, maxBatchSize: 100 },
    ],
  },
  voyageai: {
    type: 'voyageai',
    name: 'Voyage AI',
    defaultModel: 'voyage-3.5-lite',
    apiKeyPlaceholder: 'pa-...',
    models: [
      { id: 'voyage-3.5-lite', name: 'voyage-3.5-lite (1024d)', dimensions: 1024, maxBatchSize: 128 },
      { id: 'voyage-3.5', name: 'voyage-3.5 (1024d)', dimensions: 1024, maxBatchSize: 128 },
    ],
  },
};

/**
 * 모델의 차원 수 조회
 */
export function getModelDimensions(provider: EmbeddingProviderType, modelId: string): number {
  const config = PROVIDER_CONFIGS[provider];
  const model = config.models.find((m) => m.id === modelId);
  return model?.dimensions ?? config.models[0].dimensions;
}

/**
 * 프로바이더의 기본 모델 조회
 */
export function getDefaultModel(provider: EmbeddingProviderType): string {
  return PROVIDER_CONFIGS[provider].defaultModel;
}

/**
 * 현재 설정에서 활성 API 키 조회
 */
export function getActiveApiKey(settings: VaultEmbeddingsSettings): string {
  switch (settings.provider) {
    case 'openai':
      return settings.openaiApiKey;
    case 'google':
      return settings.googleApiKey;
    case 'voyageai':
      return settings.voyageaiApiKey;
    default:
      return settings.openaiApiKey;
  }
}

/**
 * 모델의 배치 크기 조회
 */
export function getMaxBatchSize(provider: EmbeddingProviderType, modelId: string): number {
  const config = PROVIDER_CONFIGS[provider];
  const model = config.models.find((m) => m.id === modelId);
  return model?.maxBatchSize ?? config.models[0].maxBatchSize;
}
