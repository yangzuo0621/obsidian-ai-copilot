import { describe, expect, it } from "vitest";

import { estimateTokens } from "../context/tokenEstimate";
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

  it("splits a single oversized line without losing content", () => {
    const chunker = new MarkdownChunker({ maxTokensPerChunk: 5 });
    const content = "a".repeat(103);

    const chunks = chunker.chunk("Notes/Long.md", "Long", content);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.content).join("")).toBe(content);
    expect(chunks.every((chunk) => chunk.tokenEstimate <= 5)).toBe(true);
    expect(chunks.every((chunk) => chunk.lineStart === 1 && chunk.lineEnd === 1)).toBe(true);
  });

  it("keeps every multi-line chunk within the configured limit", () => {
    const chunker = new MarkdownChunker({ maxTokensPerChunk: 6 });
    const chunks = chunker.chunk("Notes/Test.md", "Test", ["a".repeat(20), "b".repeat(20), "c".repeat(20)].join("\n"));

    expect(chunks).toHaveLength(3);
    expect(chunks.every((chunk) => estimateTokens(chunk.content) <= 6)).toBe(true);
  });

  it("accepts content exactly at the configured limit", () => {
    const chunks = new MarkdownChunker({ maxTokensPerChunk: 5 }).chunk("Notes/Boundary.md", "Boundary", "a".repeat(20));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.tokenEstimate).toBe(5);
  });

  it("rejects non-positive token limits", () => {
    expect(() => new MarkdownChunker({ maxTokensPerChunk: 0 }).chunk("Notes/Test.md", "Test", "content")).toThrow(
      "maxTokensPerChunk must be a positive integer.",
    );
  });
});
