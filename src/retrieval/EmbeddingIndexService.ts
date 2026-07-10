import type { TFile } from "obsidian";

import { hasMarkdownExtension } from "../obsidian/markdownFiles";
import type { EmbeddingProvider } from "./EmbeddingProvider";
import { hashContent, MarkdownChunker } from "./MarkdownChunker";
import type { MarkdownFileReader } from "./SearchService";
import type { PersistedVectorStoreData, VectorSearchResult } from "./VectorStore";
import { VectorStore } from "./VectorStore";

export interface EmbeddingSearchOptions {
  maxResults?: number;
}

type SaveVectorStoreData = (data: PersistedVectorStoreData) => Promise<void>;
type GetEmbeddingProvider = () => EmbeddingProvider;

const DEFAULT_MAX_RESULTS = 5;

export class EmbeddingIndexService {
  private readonly chunker = new MarkdownChunker();
  private readonly vectorStore: VectorStore;
  private indexPromise: Promise<void> | null = null;

  constructor(
    private readonly files: MarkdownFileReader,
    embeddingProvider: EmbeddingProvider | GetEmbeddingProvider,
    data?: PersistedVectorStoreData | null,
    private readonly saveData?: SaveVectorStoreData,
  ) {
    this.getEmbeddingProvider = typeof embeddingProvider === "function" ? embeddingProvider : () => embeddingProvider;
    this.vectorStore = new VectorStore(data);
  }

  private readonly getEmbeddingProvider: GetEmbeddingProvider;

  getPersistedData(): PersistedVectorStoreData {
    return this.vectorStore.toJSON();
  }

  async search(query: string, options: EmbeddingSearchOptions = {}): Promise<VectorSearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    await this.ensureIndexed();
    const queryEmbedding = await this.getEmbeddingProvider().embed(query);

    return this.vectorStore.search(queryEmbedding, options.maxResults ?? DEFAULT_MAX_RESULTS);
  }

  async ensureIndexed(): Promise<void> {
    this.indexPromise ??= this.rebuildStaleIndex().finally(() => {
      this.indexPromise = null;
    });

    await this.indexPromise;
  }

  async refreshFile(file: TFile): Promise<void> {
    if (!hasMarkdownExtension(file)) {
      return;
    }

    await this.indexFile(file);
    await this.persist();
  }

  async removeFile(path: string): Promise<void> {
    this.vectorStore.removeByPath(path);
    await this.persist();
  }

  private async rebuildStaleIndex(): Promise<void> {
    const files = this.files.listMarkdownFiles();
    const currentPaths = new Set(files.map((file) => file.path));

    for (const entry of this.vectorStore.toJSON().entries) {
      if (!currentPaths.has(entry.chunk.path)) {
        this.vectorStore.removeByPath(entry.chunk.path);
      }
    }

    for (const file of files) {
      await this.indexFile(file);
    }

    await this.persist();
  }

  private async indexFile(file: TFile): Promise<void> {
    const content = await this.files.readMarkdownFile(file);
    const sourceContentHash = hashContent(content);
    const existing = this.vectorStore.getByPath(file.path);
    if (existing.length > 0 && existing.every((entry) => entry.sourceContentHash === sourceContentHash)) {
      return;
    }

    const chunks = this.chunker.chunk(file.path, file.basename, content);

    this.vectorStore.removeByPath(file.path);
    if (chunks.length === 0) {
      return;
    }

    const embeddings = await this.getEmbeddingProvider().embedMany(chunks.map((chunk) => chunk.content));
    this.vectorStore.upsert(
      chunks.map((chunk, index) => ({
        chunk,
        embedding: embeddings[index] ?? [],
        sourceContentHash,
      })),
    );
  }

  private async persist(): Promise<void> {
    await this.saveData?.(this.vectorStore.toJSON());
  }
}
