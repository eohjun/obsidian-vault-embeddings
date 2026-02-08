/**
 * Plugin Settings
 */

import type { EmbeddingProviderType } from '../adapters/embedding/provider-config';

export interface VaultEmbeddingsSettings {
  /** OpenAI API 키 */
  openaiApiKey: string;

  /** 임베딩 프로바이더 */
  provider: EmbeddingProviderType;

  /** Google API 키 */
  googleApiKey: string;

  /** Voyage AI API 키 */
  voyageaiApiKey: string;

  /** 임베딩 저장 폴더 */
  storagePath: string;

  /** 임베딩에서 제외할 폴더 */
  excludedFolders: string[];

  /** 자동 임베딩 활성화 (노트 수정 시) */
  autoEmbed: boolean;

  /** 자동 임베딩 디바운스 시간 (ms) */
  autoEmbedDelay: number;

  /** 임베딩 모델 */
  model: string;
}

export const DEFAULT_SETTINGS: VaultEmbeddingsSettings = {
  openaiApiKey: '',
  provider: 'openai',
  googleApiKey: '',
  voyageaiApiKey: '',
  storagePath: '09_Embedded',
  excludedFolders: ['06_Meta', 'Templates'],
  autoEmbed: true,
  autoEmbedDelay: 5000,
  model: 'text-embedding-3-small',
};
