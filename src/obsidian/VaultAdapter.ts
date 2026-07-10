import { normalizePath, TFile, TFolder } from "obsidian";
import type { App } from "obsidian";

import { hasMarkdownExtension, isMarkdownPath } from "./markdownFiles";

export class VaultAdapter {
  constructor(private readonly app: App) {}

  listMarkdownFiles(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  async readMarkdownFile(file: TFile): Promise<string> {
    return this.app.vault.cachedRead(file);
  }

  async readNote(path: string): Promise<{ path: string; content: string }> {
    const file = this.requireMarkdownFile(path);
    return {
      path: file.path,
      content: await this.app.vault.cachedRead(file),
    };
  }

  async createNote(path: string, content: string): Promise<{ path: string }> {
    const normalized = normalizeMarkdownPath(path);
    if (this.app.vault.getAbstractFileByPath(normalized)) {
      throw new Error(`A vault item already exists at "${normalized}".`);
    }

    await this.ensureParentFolders(normalized);
    const file = await this.app.vault.create(normalized, content);
    return { path: file.path };
  }

  async appendToNote(path: string, content: string): Promise<{ path: string }> {
    const file = this.requireMarkdownFile(path);
    await this.app.vault.process(file, (current) => {
      if (!content) {
        return current;
      }
      if (!current || current.endsWith("\n")) {
        return `${current}${content}`;
      }
      return `${current}\n${content}`;
    });
    return { path: file.path };
  }

  private requireMarkdownFile(path: string): TFile {
    const normalized = normalizeMarkdownPath(path);
    const file = this.app.vault.getAbstractFileByPath(normalized);
    if (!(file instanceof TFile) || !hasMarkdownExtension(file)) {
      throw new Error(`Markdown note not found: "${normalized}".`);
    }
    return file;
  }

  private async ensureParentFolders(path: string): Promise<void> {
    const segments = path.split("/").slice(0, -1);
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing && !(existing instanceof TFolder)) {
        throw new Error(`Cannot create folder "${current}" because a file exists there.`);
      }
      if (!existing) {
        await this.app.vault.createFolder(current);
      }
    }
  }
}

export function normalizeMarkdownPath(path: string): string {
  const trimmed = path.trim().replace(/\\/g, "/");
  if (!trimmed || trimmed.startsWith("/") || /^[a-zA-Z]:/.test(trimmed) || trimmed.includes("\0")) {
    throw new Error("Note path must be a non-empty vault-relative path.");
  }
  if (trimmed.split("/").some((segment) => segment === "..")) {
    throw new Error("Note path cannot traverse outside the vault.");
  }

  const normalized = normalizePath(trimmed);
  return isMarkdownPath(normalized) ? normalized : `${normalized}.md`;
}
