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
    expect(extractSearchTerms("总结一下有关swim的内容")).toEqual(["swim", "swimming", "游泳"]);
  });

  it("extracts Chinese keyword pairs when no latin keywords are present", () => {
    expect(extractSearchTerms("总结一下有关游泳的内容")).toContain("游泳");
  });

  it("expands swimming aliases across Chinese and English", () => {
    expect(extractSearchTerms("总结一下游泳的内容")).toEqual(expect.arrayContaining(["游泳", "swim", "swimming"]));
    expect(extractSearchTerms("总结一下swim的内容")).toEqual(expect.arrayContaining(["游泳", "swim", "swimming"]));
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

  it("finds the same swimming notes from Chinese and English queries", async () => {
    const files = [
      createFile("Fitness/Swimming.md", "Swimming"),
      createFile("Fitness/游泳训练.md", "游泳训练"),
      createFile("Daily/Today.md", "Today"),
    ];
    const reader = {
      listMarkdownFiles: vi.fn(() => files),
      readMarkdownFile: vi.fn(async (file: TFile) => {
        if (file.path === "Fitness/Swimming.md") {
          return "Swim drills and freestyle technique.";
        }

        if (file.path === "Fitness/游泳训练.md") {
          return "今天的游泳训练包括自由泳。";
        }

        return "Groceries and errands.";
      }),
    };
    const service = new SearchService(reader);

    const chineseResults = await service.search("总结一下游泳的内容");
    const englishResults = await service.search("总结一下swim的内容");

    expect(chineseResults.map((result) => result.path).sort()).toEqual(["Fitness/Swimming.md", "Fitness/游泳训练.md"]);
    expect(englishResults.map((result) => result.path).sort()).toEqual(["Fitness/Swimming.md", "Fitness/游泳训练.md"]);
  });
});

function createFile(path: string, basename: string): TFile {
  return {
    path,
    basename,
  } as TFile;
}
