import { MarkdownView } from "obsidian";
import type { App, Editor, TFile, WorkspaceLeaf } from "obsidian";

export interface ActiveEditorSnapshot {
  editor: Editor;
  file: TFile | null;
  view: MarkdownView | null;
}

export class WorkspaceAdapter {
  constructor(private readonly app: App) {}

  getActiveMarkdownView(): MarkdownView | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView);
  }

  getActiveEditorSnapshot(): ActiveEditorSnapshot | null {
    const activeEditor = this.app.workspace.activeEditor;
    if (activeEditor?.editor) {
      return {
        editor: activeEditor.editor,
        file: activeEditor.file,
        view: activeEditor instanceof MarkdownView ? activeEditor : null,
      };
    }

    const markdownView = this.getActiveMarkdownView() ?? this.getMostRecentMarkdownView();
    if (!markdownView) {
      return null;
    }

    return {
      editor: markdownView.editor,
      file: markdownView.file,
      view: markdownView,
    };
  }

  getActiveFile(): TFile | null {
    return this.getActiveEditorSnapshot()?.file ?? this.app.workspace.getActiveFile();
  }

  async revealOrCreateView(viewType: string): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(viewType);
    let leaf: WorkspaceLeaf | null = existingLeaves[0] ?? null;

    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) {
        throw new Error("Unable to create sidebar leaf.");
      }

      await leaf.setViewState({
        type: viewType,
        active: true,
      });
    }

    this.app.workspace.revealLeaf(leaf);
  }

  private getMostRecentMarkdownView(): MarkdownView | null {
    const leaf = this.app.workspace.getMostRecentLeaf(this.app.workspace.rootSplit);
    return leaf?.view instanceof MarkdownView ? leaf.view : null;
  }
}
