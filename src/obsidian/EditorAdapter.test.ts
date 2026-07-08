import { describe, expect, it } from "vitest";

import { EditorAdapter } from "./EditorAdapter";
import type { WorkspaceAdapter } from "./WorkspaceAdapter";

describe("EditorAdapter", () => {
  it("reads selection from the active editor snapshot", () => {
    const adapter = new EditorAdapter({
      getActiveEditorSnapshot: () => ({
        editor: {
          getSelection: () => "selected text",
          getCursor: () => ({ line: 0, ch: 0 }),
        },
        file: null,
        view: null,
      }),
      getActiveFile: () => null,
    } as unknown as WorkspaceAdapter);

    expect(adapter.getSelection()).toBe("selected text");
  });

  it("returns one-based selection line ranges", () => {
    const adapter = new EditorAdapter({
      getActiveEditorSnapshot: () => ({
        editor: {
          getSelection: () => "selected text",
          getCursor: (side: "from" | "to") => (side === "from" ? { line: 4, ch: 2 } : { line: 6, ch: 8 }),
        },
        file: null,
        view: null,
      }),
      getActiveFile: () => null,
    } as unknown as WorkspaceAdapter);

    expect(adapter.getSelectionLineRange()).toEqual({
      lineStart: 5,
      lineEnd: 7,
    });
  });
});
