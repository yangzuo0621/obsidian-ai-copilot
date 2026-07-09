import type { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import type { EmbeddingProvider } from "./EmbeddingProvider";
import { EmbeddingIndexService } from "./EmbeddingIndexService";

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
