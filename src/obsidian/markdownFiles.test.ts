import { describe, expect, it } from "vitest";

import { hasMarkdownExtension, isMarkdownPath } from "./markdownFiles";

describe("Markdown file checks", () => {
  it("recognizes Markdown extensions case-insensitively", () => {
    expect(hasMarkdownExtension({ extension: "md" })).toBe(true);
    expect(hasMarkdownExtension({ extension: "MD" })).toBe(true);
    expect(hasMarkdownExtension({ extension: "txt" })).toBe(false);
  });

  it("recognizes Markdown paths case-insensitively", () => {
    expect(isMarkdownPath("Notes/Example.md")).toBe(true);
    expect(isMarkdownPath("Notes/Example.MD")).toBe(true);
    expect(isMarkdownPath("Notes/Example.md.backup")).toBe(false);
  });
});
