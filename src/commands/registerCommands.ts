import { Notice } from "obsidian";
import type { Plugin } from "obsidian";

import type { EditingCommandService } from "./EditingCommandService";

export function registerEditingCommands(plugin: Plugin, service: EditingCommandService): void {
  plugin.addCommand({
    id: "explain-selection",
    name: "Explain selection",
    editorCallback: (editor) => {
      void runEditingCommand("Selection explained.", () => service.explainSelection(editor));
    },
  });

  plugin.addCommand({
    id: "rewrite-selection",
    name: "Rewrite selection",
    editorCallback: (editor) => {
      void runEditingCommand("Selection rewritten.", () => service.rewriteSelection(editor));
    },
  });

  plugin.addCommand({
    id: "summarize-current-note",
    name: "Summarize current note",
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
