import type { App, TFile } from "obsidian";

export class VaultAdapter {
  constructor(private readonly app: App) {}

  listMarkdownFiles(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  async readMarkdownFile(file: TFile): Promise<string> {
    return this.app.vault.cachedRead(file);
  }
}
