import { describe, expect, it } from "vitest";

import type { MarkdownChunk } from "./MarkdownChunker";
import { cosineSimilarity, VectorStore } from "./VectorStore";

describe("VectorStore", () => {
  it("returns nearest chunks by cosine similarity", () => {
    const store = new VectorStore();
    store.upsert([
      { chunk: createChunk("a", "Alpha"), embedding: [1, 0] },
      { chunk: createChunk("b", "Beta"), embedding: [0, 1] },
    ]);

    const results = store.search([0.9, 0.1], 2);

    expect(results.map((result) => result.chunk.id)).toEqual(["a", "b"]);
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it("removes chunks by source path", () => {
    const store = new VectorStore();
    store.upsert([
      { chunk: createChunk("a", "Alpha", "One.md"), embedding: [1, 0] },
      { chunk: createChunk("b", "Beta", "Two.md"), embedding: [0, 1] },
    ]);

    store.removeByPath("One.md");

    expect(store.search([1, 0], 10).map((result) => result.chunk.id)).toEqual(["b"]);
  });

  it("handles incompatible vectors as non-matches", () => {
    expect(cosineSimilarity([1, 0], [1])).toBe(Number.NEGATIVE_INFINITY);
  });
});

function createChunk(id: string, content: string, path = `${id}.md`): MarkdownChunk {
  return {
    id,
    path,
    basename: id,
    content,
    lineStart: 1,
    lineEnd: 1,
    tokenEstimate: 1,
    contentHash: id,
  };
}
