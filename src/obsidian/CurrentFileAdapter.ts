import type { CurrentFileReader, CurrentFileSnapshot } from "../context/CurrentFileContext";

import type { VaultAdapter } from "./VaultAdapter";
import type { WorkspaceAdapter } from "./WorkspaceAdapter";

export class CurrentFileAdapter implements CurrentFileReader {
  constructor(
    private readonly workspace: WorkspaceAdapter,
    private readonly vault: VaultAdapter,
  ) {}

  async getCurrentFileSnapshot(): Promise<CurrentFileSnapshot | null> {
    const editorSnapshot = this.workspace.getActiveEditorSnapshot();
    const view = editorSnapshot?.view;
    const file = editorSnapshot?.file ?? this.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      return null;
    }

    const content = view?.file === file ? view.getViewData() : await this.vault.readMarkdownFile(file);

    return {
      path: file.path,
      basename: file.basename,
      content,
    };
  }
}
