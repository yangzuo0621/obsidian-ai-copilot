import { describe, expect, it, vi } from "vitest";

import { createBuiltinTools } from "./BuiltinTools";

describe("built-in tools", () => {
  it("uses the existing vault search service and returns structured results", async () => {
    const search = vi
      .fn()
      .mockResolvedValue([{ path: "notes/a.md", basename: "a", snippet: "match", score: 3, lineStart: 1, lineEnd: 1 }]);
    const tools = createBuiltinTools(
      createNotes(),
      { search },
      { getSelection: () => null, getActiveFilePath: () => null, replaceSelection: vi.fn() },
    );
    const tool = tools.find((candidate) => candidate.name === "search_vault");
    if (!tool) {
      throw new Error("search_vault was not registered");
    }

    const input = tool.validate({ query: "project", max_results: 3 });
    const result = await tool.run(input);

    expect(search).toHaveBeenCalledWith("project", { maxResults: 3 });
    expect(JSON.parse(result.content)).toMatchObject({ ok: true, results: [{ path: "notes/a.md" }] });
  });

  it("requires an active selection before proposing replacement", () => {
    const tools = createBuiltinTools(
      createNotes(),
      { search: vi.fn().mockResolvedValue([]) },
      { getSelection: () => "", getActiveFilePath: () => "note.md", replaceSelection: vi.fn() },
    );
    const tool = tools.find((candidate) => candidate.name === "replace_selection");

    expect(() => tool?.validate({ content: "replacement" })).toThrow("No active editor selection is available.");
  });

  it("refuses to replace a selection that changed after validation", async () => {
    let currentSelection = "original";
    const replaceSelection = vi.fn();
    const tools = createBuiltinTools(
      createNotes(),
      { search: vi.fn().mockResolvedValue([]) },
      {
        getSelection: () => currentSelection,
        getActiveFilePath: () => "note.md",
        replaceSelection,
      },
    );
    const tool = tools.find((candidate) => candidate.name === "replace_selection");
    if (!tool) {
      throw new Error("replace_selection was not registered");
    }
    const input = tool.validate({ content: "replacement" });
    currentSelection = "different";

    await expect(tool.run(input)).rejects.toThrow("changed before approval");
    expect(replaceSelection).not.toHaveBeenCalled();
  });
});

function createNotes() {
  return {
    readNote: vi.fn(),
    createNote: vi.fn(),
    appendToNote: vi.fn(),
  };
}
