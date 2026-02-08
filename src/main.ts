/**
 * Vault Embeddings Plugin
 * Centralized embedding storage for Obsidian vault
 */

import { Plugin, TFile, Notice, debounce, normalizePath } from 'obsidian';

// Domain
import type { SearchResult, SearchOptions } from './core/domain';

// Application
import {
  EmbeddingService,
  type EmbeddingStats,
  type ProgressCallback,
} from './core/application';

// Adapters
import {
  OpenAIEmbeddingProvider,
  VaultEmbeddingRepository,
  ObsidianNoteRepository,
} from './adapters';

// Settings
import { VaultEmbeddingsSettings, DEFAULT_SETTINGS } from './settings/settings';
import { VaultEmbeddingsSettingTab } from './settings/settings-tab';

export default class VaultEmbeddingsPlugin extends Plugin {
  settings!: VaultEmbeddingsSettings;

  // Services
  private embeddingProvider: OpenAIEmbeddingProvider | null = null;
  private embeddingRepository: VaultEmbeddingRepository | null = null;
  private noteRepository: ObsidianNoteRepository | null = null;
  private embeddingService: EmbeddingService | null = null;

  // Auto-embed batch queue
  private pendingAutoEmbedFiles: Map<string, TFile> = new Map();
  private processAutoEmbedDebounced: (() => void) | null = null;
  private autoEmbedProcessing = false;

  async onload(): Promise<void> {
    console.log('Loading Vault Embeddings Plugin');

    // Load settings
    await this.loadSettings();

    // Initialize services
    await this.initializeServices();

    // Register commands
    this.addCommand({
      id: 'embed-current-note',
      name: 'Embed current note',
      callback: () => this.embedCurrentNote(),
    });

    this.addCommand({
      id: 'embed-all-notes',
      name: 'Embed all notes',
      callback: () => this.embedAllNotesCommand(),
    });

    this.addCommand({
      id: 'update-stale-embeddings',
      name: 'Update stale embeddings',
      callback: () => this.updateStaleCommand(),
    });

    this.addCommand({
      id: 'show-embedding-stats',
      name: 'Show embedding statistics',
      callback: () => this.showStatsCommand(),
    });

    // Register settings tab
    this.addSettingTab(new VaultEmbeddingsSettingTab(this.app, this));

    // Register vault events for auto-embedding
    this.registerVaultEvents();

    // Ribbon icon
    this.addRibbonIcon('database', 'Vault Embeddings', () => {
      this.showStatsCommand();
    });
  }

  async onunload(): Promise<void> {
    console.log('Unloading Vault Embeddings Plugin');
    this.processAutoEmbedDebounced = null;
    this.pendingAutoEmbedFiles.clear();
    this.autoEmbedProcessing = false;
    this.embeddingService = null;
    this.embeddingRepository = null;
    this.embeddingProvider = null;
    this.noteRepository = null;
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    await this.initializeServices();
  }

  /** 초기화 에러 메시지 (디버깅용) */
  private initError: string | null = null;

  /**
   * 초기화 에러 조회
   */
  getInitError(): string | null {
    return this.initError;
  }

  /**
   * 서비스 초기화
   */
  private async initializeServices(): Promise<void> {
    this.initError = null;
    
    // API 키가 없으면 서비스 초기화하지 않음
    if (!this.settings.openaiApiKey) {
      console.log('Vault Embeddings: API key not configured');
      this.initError = 'API key not configured';
      new Notice('Vault Embeddings: API key not configured. Set it in Settings → Vault Embeddings.');
      return;
    }

    try {
      // Step 1: Embedding Provider
      console.log('Vault Embeddings: Initializing provider...');
      this.embeddingProvider = new OpenAIEmbeddingProvider(
        this.settings.openaiApiKey,
        this.settings.model
      );
      console.log('Vault Embeddings: Provider initialized');

      // Step 2: Embedding Repository
      console.log('Vault Embeddings: Creating repository...');
      this.embeddingRepository = new VaultEmbeddingRepository(this.app, {
        storagePath: this.settings.storagePath,
      });
      
      console.log('Vault Embeddings: Initializing storage...');
      try {
        await this.embeddingRepository.initialize();
        console.log('Vault Embeddings: Storage initialized');
      } catch (storageError) {
        const msg = storageError instanceof Error ? storageError.message : 'Unknown storage error';
        console.error('Vault Embeddings: Storage initialization failed:', msg);
        this.initError = `Storage initialization failed: ${msg}`;
        new Notice(`Vault Embeddings: Storage initialization failed — ${msg}`);
        return;
      }

      // Step 3: Note Repository
      this.noteRepository = new ObsidianNoteRepository(this.app);

      // Step 4: Embedding Service
      this.embeddingService = new EmbeddingService(
        this.embeddingProvider,
        this.embeddingRepository,
        this.noteRepository
      );

      // Auto-embed debounce 설정
      this.setupAutoEmbed();

      console.log('Vault Embeddings: All services initialized successfully');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Vault Embeddings: Failed to initialize services:', msg);
      this.initError = msg;
    }
  }

  /**
   * Auto-embed 설정
   */
  private setupAutoEmbed(): void {
    if (this.processAutoEmbedDebounced) {
      this.processAutoEmbedDebounced = null;
    }
    this.pendingAutoEmbedFiles.clear();

    if (this.settings.autoEmbed && this.embeddingService) {
      this.processAutoEmbedDebounced = debounce(
        () => { this.processAutoEmbedQueue(); },
        this.settings.autoEmbedDelay,
        false // trailing edge: process batch after edits settle
      );
    }
  }

  private async processAutoEmbedQueue(): Promise<void> {
    if (!this.embeddingService || !this.noteRepository) return;
    if (this.autoEmbedProcessing) {
      // 이미 처리 중이면, 누적된 파일은 다음 라운드에서 처리
      if (this.pendingAutoEmbedFiles.size > 0 && this.processAutoEmbedDebounced) {
        this.processAutoEmbedDebounced();
      }
      return;
    }

    this.autoEmbedProcessing = true;
    try {
      const filesToProcess = new Map(this.pendingAutoEmbedFiles);
      this.pendingAutoEmbedFiles.clear();

      for (const [, file] of filesToProcess) {
        const normalizedFilePath = normalizePath(file.path);
        const isExcluded = this.settings.excludedFolders.some(
          (folder) => normalizedFilePath.startsWith(normalizePath(folder) + '/')
        );
        if (isExcluded) continue;

        try {
          await this.embeddingService.embedNoteByPath(file.path);
          console.log(`Auto-embedded: ${file.path}`);
        } catch (error) {
          console.error(`Auto-embed failed for ${file.path}:`, error);
        }
      }
    } finally {
      this.autoEmbedProcessing = false;
      if (this.pendingAutoEmbedFiles.size > 0 && this.processAutoEmbedDebounced) {
        this.processAutoEmbedDebounced();
      }
    }
  }

  /**
   * Vault 이벤트 등록
   */
  private registerVaultEvents(): void {
    // 노트 수정 시
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          if (this.processAutoEmbedDebounced) {
            this.pendingAutoEmbedFiles.set(file.path, file);
            this.processAutoEmbedDebounced();
          }
        }
      })
    );

    // 노트 생성 시
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          if (this.processAutoEmbedDebounced) {
            this.pendingAutoEmbedFiles.set(file.path, file);
            this.processAutoEmbedDebounced();
          }
        }
      })
    );

    // 노트 삭제 시
    this.registerEvent(
      this.app.vault.on('delete', async (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          if (this.embeddingService && this.noteRepository) {
            try {
              const noteId = this.noteRepository.generateNoteId(file.path);
              await this.embeddingService.deleteEmbedding(noteId);
              console.log(`Deleted embedding: ${file.path}`);
            } catch (error) {
              console.error(`Failed to delete embedding for ${file.path}:`, error);
            }
          }
        }
      })
    );

    // 노트 이름 변경 시
    this.registerEvent(
      this.app.vault.on('rename', async (file, oldPath) => {
        if (file instanceof TFile && file.extension === 'md') {
          if (this.embeddingService && this.noteRepository) {
            try {
              // 이전 임베딩 삭제
              const oldNoteId = this.noteRepository.generateNoteId(oldPath);
              await this.embeddingService.deleteEmbedding(oldNoteId);

              // 새 임베딩 생성
              if (this.processAutoEmbedDebounced) {
                this.pendingAutoEmbedFiles.set(file.path, file);
                this.processAutoEmbedDebounced();
              }
            } catch (error) {
              console.error(`Failed to handle rename for ${file.path}:`, error);
            }
          }
        }
      })
    );
  }

  // ==================== Public API ====================

  /**
   * 플러그인 설정 여부
   */
  isConfigured(): boolean {
    return !!this.settings.openaiApiKey && !!this.embeddingService;
  }

  /**
   * API 키 테스트
   */
  async testApiKey(): Promise<boolean> {
    if (!this.embeddingProvider) {
      return false;
    }
    return this.embeddingProvider.testApiKey(this.settings.openaiApiKey);
  }

  /**
   * 모든 노트 임베딩
   */
  async embedAllNotes(
    onProgress?: ProgressCallback
  ): Promise<{ success: number; skipped: number; failed: number }> {
    if (!this.embeddingService) {
      throw new Error('Embedding service not initialized');
    }
    return this.embeddingService.embedAllNotes(this.settings.excludedFolders, onProgress);
  }

  /**
   * Stale 노트만 임베딩
   */
  async embedStaleNotes(
    onProgress?: ProgressCallback
  ): Promise<{ updated: number; skipped: number; failed: number }> {
    if (!this.embeddingService) {
      throw new Error('Embedding service not initialized');
    }
    return this.embeddingService.embedStaleNotes(this.settings.excludedFolders, onProgress);
  }

  /**
   * 모든 임베딩 삭제
   */
  async clearAllEmbeddings(): Promise<void> {
    if (!this.embeddingService) {
      throw new Error('Embedding service not initialized');
    }
    await this.embeddingService.clearAllEmbeddings();
  }

  /**
   * 통계 조회
   */
  async getStats(): Promise<EmbeddingStats> {
    if (!this.embeddingService) {
      return {
        totalEmbeddings: 0,
        model: this.settings.model,
        provider: 'openai',
        dimensions: 1536,
        lastUpdated: null,
      };
    }
    return this.embeddingService.getStats();
  }

  /**
   * 유사 노트 검색 (다른 플러그인에서 사용)
   */
  async searchSimilar(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!this.embeddingService) {
      return [];
    }
    return this.embeddingService.searchSimilar(query, options);
  }

  /**
   * 특정 노트와 유사한 노트 검색
   */
  async findSimilarToNote(notePath: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!this.embeddingService || !this.noteRepository) {
      return [];
    }
    const noteId = this.noteRepository.generateNoteId(notePath);
    return this.embeddingService.findSimilarToNote(noteId, options);
  }

  // ==================== Commands ====================

  private async embedCurrentNote(): Promise<void> {
    if (!this.embeddingService || !this.noteRepository) {
      new Notice('Embedding service not configured');
      return;
    }

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== 'md') {
      new Notice('No markdown file active');
      return;
    }

    try {
      const result = await this.embeddingService.embedNoteByPath(activeFile.path);

      if (result.wasUpdated) {
        new Notice(`Embedded: ${activeFile.basename}`);
      } else {
        new Notice(`Already up to date: ${activeFile.basename}`);
      }
    } catch (error) {
      new Notice('Embedding failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async embedAllNotesCommand(): Promise<void> {
    if (!this.isConfigured()) {
      const error = this.getInitError();
      if (error) {
        new Notice(`Configuration error: ${error}`);
      } else {
        new Notice('Please configure API key first');
      }
      return;
    }

    new Notice('Starting embedding...');

    try {
      const result = await this.embedAllNotes((progress) => {
        console.log(`Progress: ${progress.completed}/${progress.total}`);
      });

      new Notice(
        `Complete! ${result.success} embedded, ${result.skipped} skipped, ${result.failed} failed`
      );
    } catch (error) {
      new Notice('Embedding failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async updateStaleCommand(): Promise<void> {
    if (!this.isConfigured()) {
      new Notice('Please configure API key first');
      return;
    }

    new Notice('Updating stale embeddings...');

    try {
      const result = await this.embedStaleNotes();
      new Notice(
        `Complete! ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed`
      );
    } catch (error) {
      new Notice('Update failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async showStatsCommand(): Promise<void> {
    const stats = await this.getStats();
    new Notice(
      `Embeddings: ${stats.totalEmbeddings}\nModel: ${stats.model}\nLast updated: ${stats.lastUpdated || 'Never'}`
    );
  }
}
