import type { MarkdownChunk } from "./MarkdownChunker";

export interface VectorStoreEntry {
  chunk: MarkdownChunk;
  embedding: number[];
  sourceContentHash?: string;
}

export interface PersistedVectorStoreData {
  entries: VectorStoreEntry[];
}

export interface VectorSearchResult {
  chunk: MarkdownChunk;
  score: number;
}

export class VectorStore {
  private readonly entries = new Map<string, VectorStoreEntry>();

  constructor(data?: PersistedVectorStoreData | null) {
    for (const entry of data?.entries ?? []) {
      this.entries.set(entry.chunk.id, entry);
    }
  }

  toJSON(): PersistedVectorStoreData {
    return {
      entries: [...this.entries.values()],
    };
  }

  getByPath(path: string): VectorStoreEntry[] {
    return [...this.entries.values()].filter((entry) => entry.chunk.path === path);
  }

  upsert(entries: VectorStoreEntry[]): void {
    for (const entry of entries) {
      this.entries.set(entry.chunk.id, entry);
    }
  }

  removeByPath(path: string): void {
    for (const [id, entry] of this.entries) {
      if (entry.chunk.path === path) {
        this.entries.delete(id);
      }
    }
  }

  search(queryEmbedding: number[], maxResults: number): VectorSearchResult[] {
    return [...this.entries.values()]
      .map((entry) => ({
        chunk: entry.chunk,
        score: cosineSimilarity(queryEmbedding, entry.embedding),
      }))
      .filter((result) => Number.isFinite(result.score))
      .sort(sortByScore)
      .slice(0, maxResults);
  }
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return Number.NEGATIVE_INFINITY;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function sortByScore(left: VectorSearchResult, right: VectorSearchResult): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.chunk.path.localeCompare(right.chunk.path);
}
