import { describe, expect, it, vi } from "vitest";

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

  it("replaces the active selection", () => {
    const replaceSelection = vi.fn();
    const adapter = new EditorAdapter({
      getActiveEditorSnapshot: () => ({
        editor: {
          replaceSelection,
        },
        file: null,
        view: null,
      }),
      getActiveFile: () => null,
    } as unknown as WorkspaceAdapter);

    adapter.replaceSelection("replacement");

    expect(replaceSelection).toHaveBeenCalledWith("replacement");
  });

  it("inserts text at the cursor", () => {
    const replaceRange = vi.fn();
    const cursor = { line: 2, ch: 4 };
    const adapter = new EditorAdapter({
      getActiveEditorSnapshot: () => ({
        editor: {
          getCursor: () => cursor,
          replaceRange,
        },
        file: null,
        view: null,
      }),
      getActiveFile: () => null,
    } as unknown as WorkspaceAdapter);

    adapter.insertAtCursor("inserted");

    expect(replaceRange).toHaveBeenCalledWith("inserted", cursor);
  });
});
