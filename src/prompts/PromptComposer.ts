import type { ContextBlock } from "../context/types";
import type { ChatMessage } from "../providers/types";

import { getCommandInstruction } from "./commandPrompts";
import type { PromptMode } from "./commandPrompts";
import { CHAT_SYSTEM_PROMPT } from "./systemPrompts";

export interface ComposePromptInput {
  mode?: PromptMode;
  userInput: string;
  contextBlocks: ContextBlock[];
  history: ChatMessage[];
}

export class PromptComposer {
  compose(input: ComposePromptInput): ChatMessage[] {
    return [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      ...input.history,
      {
        role: "user",
        content: this.composeUserMessage(input.userInput, input.contextBlocks, input.mode ?? "chat"),
      },
    ];
  }

  private composeUserMessage(userInput: string, contextBlocks: ContextBlock[], mode: PromptMode): string {
    if (mode === "chat" && contextBlocks.length === 0) {
      return userInput;
    }

    const parts: string[] = [];
    const commandInstruction = getCommandInstruction(mode);
    if (commandInstruction) {
      parts.push("Task:", commandInstruction, "");
    }

    if (contextBlocks.length > 0) {
      const renderedContext = contextBlocks.map(renderContextBlock).join("\n\n");
      parts.push("Use the following Obsidian context if it helps answer the user's request.", "", renderedContext, "");
    }

    parts.push("User request:", userInput);

    return parts.join("\n");
  }
}

function renderContextBlock(block: ContextBlock): string {
  const source = block.sourcePath ? `\nSource: ${block.sourcePath}` : "";
  const lines = formatLineRange(block);
  return [
    `<context-block id="${block.id}" type="${block.type}">`,
    `Title: ${block.title}${source}${lines}`,
    "",
    block.content,
    "</context-block>",
  ].join("\n");
}

function formatLineRange(block: ContextBlock): string {
  if (!block.lineStart || !block.lineEnd) {
    return "";
  }

  return block.lineStart === block.lineEnd
    ? `\nLines: ${block.lineStart}`
    : `\nLines: ${block.lineStart}-${block.lineEnd}`;
}
