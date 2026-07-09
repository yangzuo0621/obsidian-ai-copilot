import { describe, expect, it, vi } from "vitest";

import type { SearchService } from "../retrieval/SearchService";

import { VaultSearchContext } from "./VaultSearchContext";

describe("VaultSearchContext", () => {
  it("converts search results into vault search context blocks", async () => {
    const searchService = {
      search: vi.fn(async () => [
        {
          path: "Projects/Streaming.md",
          basename: "Streaming",
          snippet: "Cancellation should stop token updates.",
          score: 4,
          lineStart: 3,
          lineEnd: 3,
        },
      ]),
    } as unknown as SearchService;
    const context = new VaultSearchContext(searchService);

    const blocks = await context.collect("streaming cancellation");

    expect(searchService.search).toHaveBeenCalledWith("streaming cancellation");
    expect(blocks).toEqual([
      {
        id: "vault-search:Projects/Streaming.md:3-3",
        type: "vault-search",
        title: "Streaming",
        content: "Cancellation should stop token updates.",
        priority: 30,
        tokenEstimate: 10,
        sourcePath: "Projects/Streaming.md",
        lineStart: 3,
        lineEnd: 3,
      },
    ]);
  });
});
