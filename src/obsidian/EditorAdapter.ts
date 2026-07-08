import type { ActiveFileReader, SelectionReader } from "../context/SelectionContext";

import type { WorkspaceAdapter } from "./WorkspaceAdapter";

export class EditorAdapter implements SelectionReader, ActiveFileReader {
  constructor(private readonly workspace: WorkspaceAdapter) {}

  getSelection(): string | null {
    return this.workspace.getActiveMarkdownView()?.editor.getSelection() ?? null;
  }

  getActiveFilePath(): string | null {
    return this.workspace.getActiveFile()?.path ?? null;
  }
}
