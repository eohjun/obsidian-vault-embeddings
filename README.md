# Vault Embeddings

A centralized embedding storage plugin for Obsidian vault - embed once, use everywhere.

## Overview

Vault Embeddings provides shared embedding infrastructure for the PKM plugin ecosystem. Instead of each plugin managing embeddings independently (causing duplication and storage waste), all plugins can use this centralized embedding service.

## Features

- **Centralized Storage**: Single embedding storage (`09_Embedded/`) for all plugins
- **Auto Embedding**: Automatically embeds notes on creation/modification
- **Content Hash Detection**: Detects stale embeddings via contentHash comparison
- **Cosine Similarity Search**: API for semantic similarity search
- **Cross-Device Sync**: Embedding data stored in vault folder for sync compatibility
- **Batch Processing**: Embed all notes or update only stale ones

## PKM Workflow

```
All Notes → Vault Embeddings → Embedding Data (09_Embedded/)
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
PKM Note      Learning Path    Knowledge
Recommender   Generator        Synthesizer
    ↓               ↓               ↓
Cross-Domain  AI Canvas       Knowledge Gap
Connector     Architect       Detector
```

## Supported AI Providers

| Provider | Model | Notes |
|----------|-------|-------|
| **OpenAI** | text-embedding-3-small | Default, cost-effective |
| **OpenAI** | text-embedding-3-large | Higher quality embeddings |

## Installation

### BRAT (Recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Open BRAT settings
3. Click "Add Beta plugin"
4. Enter: `eohjun/obsidian-vault-embeddings`
5. Enable the plugin

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from the latest release
2. Create folder: `<vault>/.obsidian/plugins/vault-embeddings/`
3. Copy downloaded files to the folder
4. Enable the plugin in Obsidian settings

## Setup

### API Key Configuration

1. Open Settings → Vault Embeddings
2. Enter your OpenAI API key
3. Configure storage path and exclusions

## Commands

| Command | Description |
|---------|-------------|
| **Embed current note** | Generate embedding for active note |
| **Embed all notes** | Embed all notes in vault (batch) |
| **Update stale embeddings** | Re-embed only modified notes |
| **Show embedding statistics** | Display embedding coverage stats |

## Consumer Plugins

The following plugins use Vault Embeddings:

| Plugin | Usage |
|--------|-------|
| **PKM Note Recommender** | Semantic similarity for note recommendations |
| **Learning Path Generator** | Prerequisite analysis via embeddings |
| **Knowledge Synthesizer** | Cluster similarity calculation |
| **Knowledge Gap Detector** | K-means clustering for sparse area detection |
| **Cross-Domain Connector** | Domain distance calculation |
| **AI Canvas Architect** | MDS layout coordinate calculation |

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| OpenAI API Key | API key for embedding generation | - |
| Storage Path | Folder for embedding data | `09_Embedded` |
| Excluded Folders | Folders to skip embedding | `06_Meta`, `Templates` |
| Auto Embed | Enable auto-embedding on note change | true |
| Auto Embed Delay | Debounce delay in ms | 5000 |
| Embedding Model | OpenAI embedding model | `text-embedding-3-small` |

## API for Consumer Plugins

Consumer plugins can access embeddings via file system:

```typescript
// Read embedding data from 09_Embedded/
const embeddingPath = '09_Embedded/embeddings.json';
const data = await this.app.vault.adapter.read(embeddingPath);
const embeddings = JSON.parse(data);

// Search similar notes
const results = embeddings.filter(e =>
  cosineSimilarity(queryVector, e.vector) > threshold
);
```

## Development

```bash
# Install dependencies
npm install

# Development with watch mode
npm run dev

# Production build
npm run build
```

## License

MIT
