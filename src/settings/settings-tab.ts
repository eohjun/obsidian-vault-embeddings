/**
 * Settings Tab
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type VaultEmbeddingsPlugin from '../main';
import { ProgressModal } from '../ui/progress-modal';
import {
  PROVIDER_CONFIGS,
  getActiveApiKey,
  getDefaultModel,
  type EmbeddingProviderType,
} from '../adapters/embedding/provider-config';

export class VaultEmbeddingsSettingTab extends PluginSettingTab {
  plugin: VaultEmbeddingsPlugin;

  constructor(app: App, plugin: VaultEmbeddingsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Vault Embeddings Settings' });

    // Dimension mismatch warning (async — inserted at top if needed)
    this.displayMismatchWarning(containerEl);

    // API Settings Section
    containerEl.createEl('h3', { text: 'API Settings' });

    // Provider dropdown
    new Setting(containerEl)
      .setName('Embedding Provider')
      .setDesc('Select the embedding provider to use')
      .addDropdown((dropdown) => {
        for (const [key, config] of Object.entries(PROVIDER_CONFIGS)) {
          dropdown.addOption(key, config.name);
        }
        dropdown.setValue(this.plugin.settings.provider);
        dropdown.onChange(async (value) => {
          const provider = value as EmbeddingProviderType;
          this.plugin.settings.provider = provider;
          this.plugin.settings.model = getDefaultModel(provider);
          await this.plugin.saveSettings();
          this.display(); // re-render for conditional fields
        });
      });

    // Active provider's API key
    const providerConfig = PROVIDER_CONFIGS[this.plugin.settings.provider];

    new Setting(containerEl)
      .setName(`${providerConfig.name} API Key`)
      .setDesc(`API key for ${providerConfig.name} embeddings`)
      .addText((text) => {
        text
          .setPlaceholder(providerConfig.apiKeyPlaceholder)
          .setValue(getActiveApiKey(this.plugin.settings))
          .onChange(async (value) => {
            switch (this.plugin.settings.provider) {
              case 'openai':
                this.plugin.settings.openaiApiKey = value;
                break;
              case 'google':
                this.plugin.settings.googleApiKey = value;
                break;
              case 'voyageai':
                this.plugin.settings.voyageaiApiKey = value;
                break;
            }
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
        text.inputEl.style.width = '300px';
      })
      .addButton((button) => {
        button.setButtonText('Test').onClick(async () => {
          if (!getActiveApiKey(this.plugin.settings)) {
            new Notice('Please enter an API key first');
            return;
          }

          button.setDisabled(true);
          button.setButtonText('Testing...');

          try {
            const isValid = await this.plugin.testApiKey();
            if (isValid) {
              new Notice('API key is valid!');
            } else {
              new Notice('API key is invalid');
            }
          } catch (error) {
            new Notice('Test failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
          } finally {
            button.setDisabled(false);
            button.setButtonText('Test');
          }
        });
      });

    // Model dropdown
    new Setting(containerEl)
      .setName('Embedding Model')
      .setDesc('Select the model to use for generating embeddings')
      .addDropdown((dropdown) => {
        for (const model of providerConfig.models) {
          dropdown.addOption(model.id, model.name);
        }
        dropdown.setValue(this.plugin.settings.model);
        dropdown.onChange(async (value) => {
          this.plugin.settings.model = value;
          await this.plugin.saveSettings();
          this.display(); // re-render to update mismatch warning
        });
      });

    // Storage Settings Section
    containerEl.createEl('h3', { text: 'Storage Settings' });

    new Setting(containerEl)
      .setName('Storage Folder')
      .setDesc('Folder to store embedding data (will be created if not exists)')
      .addText((text) =>
        text
          .setPlaceholder('09_Embedded')
          .setValue(this.plugin.settings.storagePath)
          .onChange(async (value) => {
            this.plugin.settings.storagePath = value || '09_Embedded';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Excluded Folders')
      .setDesc('Folders to exclude from embedding (comma-separated)')
      .addText((text) =>
        text
          .setPlaceholder('06_Meta, Templates')
          .setValue(this.plugin.settings.excludedFolders.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.excludedFolders = value
              .split(',')
              .map((f) => f.trim())
              .filter((f) => f.length > 0);
            await this.plugin.saveSettings();
          })
      );

    // Auto Embedding Section
    containerEl.createEl('h3', { text: 'Auto Embedding' });

    new Setting(containerEl)
      .setName('Auto Embed')
      .setDesc('Automatically create/update embeddings when notes are created or modified')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoEmbed).onChange(async (value) => {
          this.plugin.settings.autoEmbed = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Auto Embed Delay')
      .setDesc('Delay before auto-embedding after modification (in seconds)')
      .addSlider((slider) =>
        slider
          .setLimits(1, 30, 1)
          .setValue(this.plugin.settings.autoEmbedDelay / 1000)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.autoEmbedDelay = value * 1000;
            await this.plugin.saveSettings();
          })
      );

    // Actions Section
    containerEl.createEl('h3', { text: 'Actions' });

    new Setting(containerEl)
      .setName('Embed All Notes')
      .setDesc('Generate embeddings for all notes in the vault')
      .addButton((button) => {
        button
          .setButtonText('Embed All')
          .setCta()
          .onClick(async () => {
            if (!this.plugin.isConfigured()) {
              new Notice('Please configure API key first');
              return;
            }

            const modal = new ProgressModal(this.app, 'Embedding All Notes');
            modal.open();

            try {
              const result = await this.plugin.embedAllNotes((progress) => {
                const attempted = progress.completed + progress.failed;
                const success = progress.completed - progress.skipped;
                const pct = progress.total > 0
                  ? Math.round((attempted / progress.total) * 100)
                  : 0;
                modal.updateProgress({
                  current: attempted,
                  total: progress.total,
                  message: `Processing: ${success} / ${attempted} (${progress.skipped} skipped, ${progress.failed} failed)`,
                  percentage: pct,
                });
              });

              modal.setComplete(
                `Complete! ${result.success} embedded, ${result.skipped} skipped, ${result.failed} failed`
              );
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Unknown error';
              modal.setError(`Failed: ${msg}`);
            }
          });
      });

    new Setting(containerEl)
      .setName('Update Stale Embeddings')
      .setDesc('Only update embeddings for modified notes')
      .addButton((button) => {
        button.setButtonText('Update Stale').onClick(async () => {
          if (!this.plugin.isConfigured()) {
            new Notice('Please configure API key first');
            return;
          }

          const modal = new ProgressModal(this.app, 'Updating Stale Embeddings');
          modal.open();

          try {
            const result = await this.plugin.embedStaleNotes((progress) => {
              const attempted = progress.completed + progress.failed;
              const updated = progress.completed - progress.skipped;
              const pct = progress.total > 0
                ? Math.round((attempted / progress.total) * 100)
                : 0;
              modal.updateProgress({
                current: attempted,
                total: progress.total,
                message: `Checking: ${updated} updated / ${attempted} checked (${progress.skipped} unchanged)`,
                percentage: pct,
              });
            });

            modal.setComplete(
              `Complete! ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed`
            );
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            modal.setError(`Failed: ${msg}`);
          }
        });
      });

    new Setting(containerEl)
      .setName('Clear All Embeddings')
      .setDesc('Delete all stored embeddings')
      .addButton((button) => {
        button
          .setButtonText('Clear All')
          .setWarning()
          .onClick(async () => {
            const confirmed = confirm('Are you sure you want to delete all embeddings?');
            if (!confirmed) return;

            try {
              await this.plugin.clearAllEmbeddings();
              new Notice('All embeddings cleared');
            } catch (error) {
              new Notice('Clear failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
            }
          });
      });

    // Statistics Section
    containerEl.createEl('h3', { text: 'Statistics' });

    const statsEl = containerEl.createDiv({ cls: 'vault-embeddings-stats' });
    this.displayStats(statsEl);
  }

  /**
   * 차원 불일치 경고 배너 (비동기)
   */
  private async displayMismatchWarning(container: HTMLElement): Promise<void> {
    try {
      const result = await this.plugin.hasProviderMismatch();
      if (result.mismatch) {
        const warningEl = container.createDiv({ cls: 'vault-embeddings-mismatch-warning' });
        warningEl.style.padding = '12px';
        warningEl.style.marginBottom = '12px';
        warningEl.style.backgroundColor = 'var(--background-modifier-error)';
        warningEl.style.borderRadius = '8px';
        warningEl.style.color = 'var(--text-on-accent)';

        warningEl.createEl('strong', { text: 'Dimension Mismatch Warning' });
        warningEl.createEl('p', {
          text: `Stored embeddings use ${result.storedDimensions}d vectors. ` +
            `Current provider/model uses ${result.currentDimensions}d. ` +
            `Run "Embed All" to re-embed all notes with the new provider.`,
        });

        // Move warning to right after the h2
        const h2 = container.querySelector('h2');
        if (h2 && h2.nextSibling) {
          container.insertBefore(warningEl, h2.nextSibling);
        }
      }
    } catch {
      // silently ignore — stats may not be available yet
    }
  }

  private async displayStats(container: HTMLElement): Promise<void> {
    container.empty();

    try {
      const stats = await this.plugin.getStats();

      container.createEl('p', {
        text: `Total embeddings: ${stats.totalEmbeddings}`,
      });
      container.createEl('p', {
        text: `Model: ${stats.model || 'Not set'}`,
      });
      container.createEl('p', {
        text: `Provider: ${stats.provider || 'Not set'}`,
      });
      container.createEl('p', {
        text: `Dimensions: ${stats.dimensions || 'Not set'}`,
      });
      container.createEl('p', {
        text: `Last updated: ${stats.lastUpdated || 'Never'}`,
      });
    } catch {
      container.createEl('p', { text: 'Unable to load statistics' });
    }
  }
}
