import { Notice } from "obsidian";
import type { Plugin } from "obsidian";

import type { EditingCommandService } from "./EditingCommandService";

export function registerEditingCommands(plugin: Plugin, service: EditingCommandService): void {
  plugin.addCommand({
    id: "ask-copilot-explain-selection",
    name: "Ask Copilot: Explain Selection",
    editorCallback: (editor) => {
      void runEditingCommand("Selection explained.", () => service.explainSelection(editor));
    },
  });

  plugin.addCommand({
    id: "ask-copilot-rewrite-selection",
    name: "Ask Copilot: Rewrite Selection",
    editorCallback: (editor) => {
      void runEditingCommand("Selection rewritten.", () => service.rewriteSelection(editor));
    },
  });

  plugin.addCommand({
    id: "ask-copilot-summarize-current-note",
    name: "Ask Copilot: Summarize Current Note",
    editorCallback: (editor) => {
      void runEditingCommand("Summary inserted.", () => service.summarizeCurrentNote(editor));
    },
  });
}

async function runEditingCommand(successMessage: string, command: () => Promise<unknown>): Promise<void> {
  try {
    new Notice("Ask Copilot is writing...");
    await command();
    new Notice(successMessage);
  } catch (error) {
    console.error("Ask Copilot editing command failed:", error);
    new Notice(`Ask Copilot failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
