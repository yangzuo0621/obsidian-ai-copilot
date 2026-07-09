import type { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { extractSearchTerms, SearchService } from "./SearchService";

describe("SearchService", () => {
  it("extracts useful search terms from a user question", () => {
    expect(extractSearchTerms("What do my project notes say about streaming cancellation?")).toEqual([
      "project",
      "notes",
      "streaming",
      "cancellation",
    ]);
  });

  it("searches markdown filenames and content snippets", async () => {
    const files = [createFile("Projects/Streaming.md", "Streaming"), createFile("Daily/Today.md", "Today")];
    const reader = {
      listMarkdownFiles: vi.fn(() => files),
      readMarkdownFile: vi.fn(async (file: TFile) =>
        file.path === "Projects/Streaming.md"
          ? "# Streaming\n\nCancellation should stop token updates.\n\nOther notes."
          : "# Today\n\nGroceries and errands.",
      ),
    };
    const service = new SearchService(reader);

    const results = await service.search("How does cancellation token work?", {
      maxResults: 3,
      snippetLineRadius: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      path: "Projects/Streaming.md",
      basename: "Streaming",
      lineStart: 2,
      lineEnd: 4,
    });
    expect(results[0]?.snippet).toContain("Cancellation should stop token updates.");
  });
});

function createFile(path: string, basename: string): TFile {
  return {
    path,
    basename,
  } as TFile;
}
