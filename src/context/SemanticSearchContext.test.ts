import { describe, expect, it, vi } from "vitest";

import { SemanticSearchContext } from "./SemanticSearchContext";

describe("SemanticSearchContext", () => {
  it("converts semantic search results into context blocks", async () => {
    const context = new SemanticSearchContext({
      search: vi.fn(async () => [
        {
          score: 0.9,
          chunk: {
            id: "semantic-search:Note.md:1-2:abcd",
            path: "Note.md",
            basename: "Note",
            content: "Related note text",
            lineStart: 1,
            lineEnd: 2,
            tokenEstimate: 4,
            contentHash: "abcd",
          },
        },
      ]),
    } as never);

    const blocks = await context.collect("related topic");

    expect(blocks).toEqual([
      {
        id: "semantic-search:Note.md:1-2:abcd",
        type: "semantic-search",
        title: "Note",
        content: "Related note text",
        priority: 35,
        tokenEstimate: 4,
        sourcePath: "Note.md",
        lineStart: 1,
        lineEnd: 2,
      },
    ]);
  });
});
