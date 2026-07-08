import { MarkdownView } from "obsidian";
import type { App, TFile, WorkspaceLeaf } from "obsidian";

export class WorkspaceAdapter {
  constructor(private readonly app: App) {}

  getActiveMarkdownView(): MarkdownView | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView);
  }

  getActiveFile(): TFile | null {
    return this.getActiveMarkdownView()?.file ?? this.app.workspace.getActiveFile();
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
}
