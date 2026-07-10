import { Notice } from "obsidian";
import type { Plugin } from "obsidian";

import type { EditingCommandService } from "./EditingCommandService";

export function registerEditingCommands(plugin: Plugin, service: EditingCommandService): void {
  plugin.addCommand({
    id: "vault-loom-explain-selection",
    name: "Vault Loom: Explain Selection",
    editorCallback: (editor) => {
      void runEditingCommand("Selection explained.", () => service.explainSelection(editor));
    },
  });

  plugin.addCommand({
    id: "vault-loom-rewrite-selection",
    name: "Vault Loom: Rewrite Selection",
    editorCallback: (editor) => {
      void runEditingCommand("Selection rewritten.", () => service.rewriteSelection(editor));
    },
  });

  plugin.addCommand({
    id: "vault-loom-summarize-current-note",
    name: "Vault Loom: Summarize Current Note",
    editorCallback: (editor) => {
      void runEditingCommand("Summary inserted.", () => service.summarizeCurrentNote(editor));
    },
  });
}

async function runEditingCommand(successMessage: string, command: () => Promise<unknown>): Promise<void> {
  try {
    new Notice("Vault Loom is writing...");
    await command();
    new Notice(successMessage);
  } catch (error) {
    console.error("Vault Loom editing command failed:", error);
    new Notice(`Vault Loom failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
