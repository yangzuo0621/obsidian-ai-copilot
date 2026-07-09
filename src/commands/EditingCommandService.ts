import type { Editor } from "obsidian";

import type { ContextBlock } from "../context/types";
import type { EditorAdapter } from "../obsidian/EditorAdapter";
import { createProvider } from "../providers/ProviderRegistry";
import { PromptComposer } from "../prompts/PromptComposer";
import type { PromptMode } from "../prompts/commandPrompts";
import type { CopilotSettings } from "../settings/types";

interface ContextBuilderLike {
  build(options: {
    includeCurrentFile: boolean;
    includeSelection: boolean;
    includeVaultSearch: boolean;
    includeEmbeddingRetrieval: boolean;
    tokenBudget: number;
    userInput: string;
  }): Promise<ContextBlock[]>;
}

export interface EditingCommandResult {
  content: string;
  inserted: boolean;
  replacedSelection: boolean;
}

export class EditingCommandService {
  private readonly promptComposer = new PromptComposer();

  constructor(
    private readonly getSettings: () => CopilotSettings,
    private readonly contextBuilder: ContextBuilderLike,
    private readonly editorAdapter: EditorAdapter,
  ) {}

  async explainSelection(editor?: Editor): Promise<EditingCommandResult> {
    this.requireSelection(editor);
    const content = await this.completeCommand("explain-selection", "Explain this selection.", {
      includeCurrentFile: false,
      includeSelection: true,
    });

    this.editorAdapter.insertAtCursor(formatInsertedSection("AI explanation", content), editor);

    return {
      content,
      inserted: true,
      replacedSelection: false,
    };
  }

  async rewriteSelection(editor?: Editor): Promise<EditingCommandResult> {
    const selection = this.requireSelection(editor);
    const content = await this.completeCommand("rewrite-selection", "Rewrite this selection.", {
      includeCurrentFile: false,
      includeSelection: true,
    });

    this.editorAdapter.replaceSelection(content.trim() || selection, editor);

    return {
      content,
      inserted: false,
      replacedSelection: true,
    };
  }

  async summarizeCurrentNote(editor?: Editor): Promise<EditingCommandResult> {
    const content = await this.completeCommand("summarize-note", "Summarize the current note.", {
      includeCurrentFile: true,
      includeSelection: false,
    });

    this.editorAdapter.insertAtCursor(formatInsertedSection("AI summary", content), editor);

    return {
      content,
      inserted: true,
      replacedSelection: false,
    };
  }

  private requireSelection(editor?: Editor): string {
    const selection = this.editorAdapter.getSelection(editor)?.trim();
    if (!selection) {
      throw new Error("Select text in the active editor first.");
    }

    return selection;
  }

  private async completeCommand(
    mode: PromptMode,
    userInput: string,
    contextOptions: { includeCurrentFile: boolean; includeSelection: boolean },
  ): Promise<string> {
    const settings = this.getSettings();
    const contextBlocks = await this.contextBuilder.build({
      ...contextOptions,
      includeVaultSearch: false,
      includeEmbeddingRetrieval: false,
      tokenBudget: settings.contextTokenBudget,
      userInput,
    });

    if (contextBlocks.length === 0) {
      throw new Error("No editor context is available for this command.");
    }

    const provider = createProvider(settings);
    const result = await provider.complete({
      model: settings.model,
      temperature: settings.temperature,
      messages: this.promptComposer.compose({
        mode,
        userInput,
        contextBlocks,
        history: [],
      }),
    });

    return result.content.trim();
  }
}

function formatInsertedSection(label: string, content: string): string {
  const trimmed = content.trim();
  return `\n\n${label}:\n${trimmed}\n`;
}
