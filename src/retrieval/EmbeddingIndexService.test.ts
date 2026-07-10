import type { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import type { EmbeddingProvider } from "./EmbeddingProvider";
import { EmbeddingIndexService } from "./EmbeddingIndexService";
import { hashContent } from "./MarkdownChunker";

describe("EmbeddingIndexService", () => {
  it("indexes markdown chunks and searches by query embedding", async () => {
    const file = createFile("Projects/Streaming.md", "Streaming");
    const provider = createEmbeddingProvider({
      "Cancellation should stop token updates.": [1, 0],
      "Cooking notes and recipes.": [0, 1],
      cancellation: [1, 0],
    });
    const service = new EmbeddingIndexService(
      {
        listMarkdownFiles: () => [file, createFile("Home/Cooking.md", "Cooking")],
        readMarkdownFile: async (candidate) =>
          candidate.path === file.path ? "Cancellation should stop token updates." : "Cooking notes and recipes.",
      },
      provider,
    );

    const results = await service.search("cancellation");

    expect(results[0]?.chunk.path).toBe("Projects/Streaming.md");
    expect(provider.embedMany).toHaveBeenCalledTimes(2);
  });

  it("refreshes and removes one file from the persisted index", async () => {
    const file = createFile("Projects/Streaming.md", "Streaming");
    const saveData = vi.fn().mockResolvedValue(undefined);
    const service = new EmbeddingIndexService(
      {
        listMarkdownFiles: () => [file],
        readMarkdownFile: async () => "Cancellation should stop token updates.",
      },
      createEmbeddingProvider({
        "Cancellation should stop token updates.": [1, 0],
      }),
      null,
      saveData,
    );

    await service.refreshFile(file);
    expect(service.getPersistedData().entries).toHaveLength(1);

    await service.removeFile(file.path);
    expect(service.getPersistedData().entries).toHaveLength(0);
    expect(saveData).toHaveBeenCalledTimes(2);
  });

  it("keeps chunk identity separate from the source file version", async () => {
    const file = createFile("Projects/Large.md", "Large");
    const content = `${"a".repeat(800)}\n${"b".repeat(800)}`;
    const provider = createEmbeddingProvider({});
    const service = new EmbeddingIndexService(
      {
        listMarkdownFiles: () => [file],
        readMarkdownFile: async () => content,
      },
      provider,
    );

    await service.refreshFile(file);

    const entries = service.getPersistedData().entries;
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.chunk.contentHash).toBe(hashContent(entry.chunk.content));
      expect(entry.chunk.id).toContain(entry.chunk.contentHash);
      expect(entry.sourceContentHash).toBe(hashContent(content));
    }
  });

  it("rebuilds legacy entries that do not have a source content hash", async () => {
    const file = createFile("Projects/Legacy.md", "Legacy");
    const content = "Legacy index content that should be rebuilt.";
    const provider = createEmbeddingProvider({ [content]: [1, 0] });
    const service = new EmbeddingIndexService(
      {
        listMarkdownFiles: () => [file],
        readMarkdownFile: async () => content,
      },
      provider,
      {
        entries: [
          {
            chunk: {
              id: "legacy-entry",
              path: file.path,
              basename: file.basename,
              content: "stale content",
              lineStart: 1,
              lineEnd: 1,
              tokenEstimate: 3,
              contentHash: "legacy",
            },
            embedding: [0, 1],
          },
        ],
      },
    );

    await service.ensureIndexed();

    expect(provider.embedMany).toHaveBeenCalledWith([content]);
    expect(service.getPersistedData().entries[0]?.chunk.id).not.toBe("legacy-entry");
  });
});

function createEmbeddingProvider(vectors: Record<string, number[]>): EmbeddingProvider {
  return {
    embed: vi.fn(async (input: string) => vectors[input] ?? [0, 1]),
    embedMany: vi.fn(async (inputs: string[]) => inputs.map((input) => vectors[input] ?? [0, 1])),
  };
}

function createFile(path: string, basename: string): TFile {
  return {
    path,
    basename,
    extension: "md",
  } as TFile;
}
