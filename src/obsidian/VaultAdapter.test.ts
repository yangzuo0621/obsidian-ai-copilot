import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  normalizePath: (path: string) => path.replace(/\/{2,}/g, "/").replace(/^\.\//, ""),
  TFile: class {},
  TFolder: class {},
}));

import { normalizeMarkdownPath } from "./VaultAdapter";

describe("normalizeMarkdownPath", () => {
  it("normalizes vault-relative paths and adds the Markdown extension", () => {
    expect(normalizeMarkdownPath(" ./folder\\note ")).toBe("folder/note.md");
    expect(normalizeMarkdownPath("folder/note.MD")).toBe("folder/note.MD");
  });

  it.each(["", "/absolute.md", "C:/outside.md", "folder/../outside.md"])("rejects unsafe path %j", (path) => {
    expect(() => normalizeMarkdownPath(path)).toThrow();
  });
});
