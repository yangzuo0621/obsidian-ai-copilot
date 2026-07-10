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

  it("extracts latin keywords from mixed Chinese and English questions", () => {
    expect(extractSearchTerms("总结一下有关streaming的内容")).toEqual(["streaming"]);
  });

  it("extracts Chinese keyword pairs when no latin keywords are present", () => {
    expect(extractSearchTerms("总结一下有关游泳的内容")).toContain("游泳");
  });

  it("does not invent translations or domain-specific aliases", () => {
    expect(extractSearchTerms("总结一下swim的内容")).toEqual(["swim"]);
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

  it("searches Chinese note names and contents with Chinese terms", async () => {
    const files = [createFile("Fitness/游泳训练.md", "游泳训练"), createFile("Daily/Today.md", "Today")];
    const reader = {
      listMarkdownFiles: vi.fn(() => files),
      readMarkdownFile: vi.fn(async (file: TFile) => {
        if (file.path === "Fitness/游泳训练.md") {
          return "今天的游泳训练包括自由泳。";
        }

        return "Groceries and errands.";
      }),
    };
    const service = new SearchService(reader);

    const results = await service.search("总结一下游泳的内容");

    expect(results.map((result) => result.path)).toEqual(["Fitness/游泳训练.md"]);
  });
});

function createFile(path: string, basename: string): TFile {
  return {
    path,
    basename,
  } as TFile;
}
