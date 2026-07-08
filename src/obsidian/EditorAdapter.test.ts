import { describe, expect, it } from "vitest";

import { EditorAdapter } from "./EditorAdapter";
import type { WorkspaceAdapter } from "./WorkspaceAdapter";

describe("EditorAdapter", () => {
  it("reads selection from the active editor snapshot", () => {
    const adapter = new EditorAdapter({
      getActiveEditorSnapshot: () => ({
        editor: {
          getSelection: () => "selected text",
        },
        file: null,
        view: null,
      }),
      getActiveFile: () => null,
    } as unknown as WorkspaceAdapter);

    expect(adapter.getSelection()).toBe("selected text");
  });
});
