import { describe, expect, it, vi } from "vitest";

import { ContextBuilder } from "./ContextBuilder";
import type { ContextBlock, ContextSource } from "./types";

describe("ContextBuilder", () => {
  it("uses selection context before current file context", async () => {
    const selection = createSource(createBlock("selection", "selection"));
    const currentFile = createSource(createBlock("current-file", "current-file"));
    const builder = new ContextBuilder({ selection, currentFile });

    const blocks = await builder.build({
      includeCurrentFile: true,
      includeSelection: true,
      includeVaultSearch: false,
      includeEmbeddingRetrieval: false,
      tokenBudget: 100,
      userInput: "question",
    });

    expect(blocks.map((block) => block.id)).toEqual(["selection"]);
    expect(currentFile.collect).not.toHaveBeenCalled();
  });

  it("falls back to current file when selection is empty", async () => {
    const selection = createSource(null);
    const currentFile = createSource(createBlock("current-file", "current-file"));
    const builder = new ContextBuilder({ selection, currentFile });

    const blocks = await builder.build({
      includeCurrentFile: true,
      includeSelection: true,
      includeVaultSearch: false,
      includeEmbeddingRetrieval: false,
      tokenBudget: 100,
      userInput: "question",
    });

    expect(blocks.map((block) => block.id)).toEqual(["current-file"]);
  });

  it("adds vault search context after editor context", async () => {
    const selection = createSource(null);
    const currentFile = createSource(createBlock("current-file", "current-file"));
    const vaultSearch = {
      collect: vi.fn(async () => [createBlock("vault-search", "vault-search")]),
    };
    const builder = new ContextBuilder({ selection, currentFile, vaultSearch });

    const blocks = await builder.build({
      includeCurrentFile: true,
      includeSelection: true,
      includeVaultSearch: true,
      includeEmbeddingRetrieval: false,
      tokenBudget: 100,
      userInput: "search terms",
    });

    expect(vaultSearch.collect).toHaveBeenCalledWith("search terms");
    expect(blocks.map((block) => block.id)).toEqual(["current-file", "vault-search"]);
  });

  it("adds semantic search context when embedding retrieval is enabled", async () => {
    const selection = createSource(null);
    const currentFile = createSource(createBlock("current-file", "current-file"));
    const vaultSearch = {
      collect: vi.fn(async () => [createBlock("vault-search", "vault-search")]),
    };
    const semanticSearch = {
      collect: vi.fn(async () => [createBlock("semantic-search", "semantic-search")]),
    };
    const builder = new ContextBuilder({ selection, currentFile, vaultSearch, semanticSearch });

    const blocks = await builder.build({
      includeCurrentFile: true,
      includeSelection: true,
      includeVaultSearch: true,
      includeEmbeddingRetrieval: true,
      tokenBudget: 100,
      userInput: "search terms",
    });

    expect(semanticSearch.collect).toHaveBeenCalledWith("search terms");
    expect(blocks.map((block) => block.id)).toEqual(["current-file", "semantic-search", "vault-search"]);
  });
});

function createSource(block: ContextBlock | null): ContextSource {
  return {
    collect: vi.fn(async () => block),
  };
}

function createBlock(
  id: string,
  type: "selection" | "current-file" | "vault-search" | "semantic-search",
): ContextBlock {
  return {
    id,
    type,
    title: id,
    content: "content",
    priority: type === "selection" ? 100 : type === "current-file" ? 60 : type === "semantic-search" ? 35 : 30,
    tokenEstimate: 2,
  };
}
