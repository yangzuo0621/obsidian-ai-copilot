import type { Editor } from "obsidian";

import type { ActiveFileReader, SelectionLineRange, SelectionReader } from "../context/SelectionContext";

import type { WorkspaceAdapter } from "./WorkspaceAdapter";

export class EditorAdapter implements SelectionReader, ActiveFileReader {
  constructor(private readonly workspace: WorkspaceAdapter) {}

  getSelection(editor?: Editor): string | null {
    return (editor ?? this.workspace.getActiveEditorSnapshot()?.editor)?.getSelection() ?? null;
  }

  getSelectionLineRange(editor?: Editor): SelectionLineRange | null {
    const activeEditor = editor ?? this.workspace.getActiveEditorSnapshot()?.editor;
    if (!activeEditor?.getSelection()) {
      return null;
    }

    const from = activeEditor.getCursor("from");
    const to = activeEditor.getCursor("to");

    return {
      lineStart: Math.min(from.line, to.line) + 1,
      lineEnd: Math.max(from.line, to.line) + 1,
    };
  }

  getActiveFilePath(): string | null {
    return this.workspace.getActiveFile()?.path ?? null;
  }

  replaceSelection(text: string, editor?: Editor): void {
    const activeEditor = editor ?? this.workspace.getActiveEditorSnapshot()?.editor;
    if (!activeEditor) {
      throw new Error("No active editor is available.");
    }

    activeEditor.replaceSelection(text);
  }

  insertAtCursor(text: string, editor?: Editor): void {
    const activeEditor = editor ?? this.workspace.getActiveEditorSnapshot()?.editor;
    if (!activeEditor) {
      throw new Error("No active editor is available.");
    }

    activeEditor.replaceRange(text, activeEditor.getCursor());
  }
}
