import type { ActiveFileReader, SelectionLineRange, SelectionReader } from "../context/SelectionContext";

import type { WorkspaceAdapter } from "./WorkspaceAdapter";

export class EditorAdapter implements SelectionReader, ActiveFileReader {
  constructor(private readonly workspace: WorkspaceAdapter) {}

  getSelection(): string | null {
    return this.workspace.getActiveEditorSnapshot()?.editor.getSelection() ?? null;
  }

  getSelectionLineRange(): SelectionLineRange | null {
    const editor = this.workspace.getActiveEditorSnapshot()?.editor;
    if (!editor?.getSelection()) {
      return null;
    }

    const from = editor.getCursor("from");
    const to = editor.getCursor("to");

    return {
      lineStart: Math.min(from.line, to.line) + 1,
      lineEnd: Math.max(from.line, to.line) + 1,
    };
  }

  getActiveFilePath(): string | null {
    return this.workspace.getActiveFile()?.path ?? null;
  }
}
