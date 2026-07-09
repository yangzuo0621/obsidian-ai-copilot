import { describe, expect, it } from "vitest";

import { hashContent, MarkdownChunker } from "./MarkdownChunker";

describe("MarkdownChunker", () => {
  it("creates line-aware markdown chunks", () => {
    const chunker = new MarkdownChunker({ maxTokensPerChunk: 8 });

    const chunks = chunker.chunk(
      "Notes/Test.md",
      "Test",
      "First paragraph has enough text.\nSecond paragraph also matters.",
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatchObject({
      path: "Notes/Test.md",
      basename: "Test",
      lineStart: 1,
      lineEnd: 1,
    });
    expect(chunks[1]?.lineStart).toBe(2);
  });

  it("hashes content consistently", () => {
    expect(hashContent("same")).toBe(hashContent("same"));
    expect(hashContent("same")).not.toBe(hashContent("different"));
  });
});
