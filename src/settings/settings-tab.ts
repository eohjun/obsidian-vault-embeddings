/**
 * Settings Tab
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type VaultEmbeddingsPlugin from '../main';
import { ProgressModal } from '../ui/progress-modal';

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

    // API Settings Section
    containerEl.createEl('h3', { text: 'API Settings' });

    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('API key for generating embeddings (text-embedding-3-small)')
      .addText((text) => {
        text
          .setPlaceholder('sk-...')
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
        text.inputEl.style.width = '300px';
      })
      .addButton((button) => {
        button.setButtonText('Test').onClick(async () => {
          if (!this.plugin.settings.openaiApiKey) {
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
                `✅ Complete! ${result.success} embedded, ${result.skipped} skipped, ${result.failed} failed`
              );
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Unknown error';
              modal.setError(`❌ Failed: ${msg}`);
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
              `✅ Complete! ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed`
            );
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            modal.setError(`❌ Failed: ${msg}`);
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
