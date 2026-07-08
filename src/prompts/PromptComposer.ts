import type { ContextBlock } from "../context/types";
import type { ChatMessage } from "../providers/types";

import { CHAT_SYSTEM_PROMPT } from "./systemPrompts";

export interface ComposePromptInput {
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
        content: this.composeUserMessage(input.userInput, input.contextBlocks),
      },
    ];
  }

  private composeUserMessage(userInput: string, contextBlocks: ContextBlock[]): string {
    if (contextBlocks.length === 0) {
      return userInput;
    }

    const renderedContext = contextBlocks.map(renderContextBlock).join("\n\n");

    return [
      "Use the following Obsidian context if it helps answer the user's request.",
      "",
      renderedContext,
      "",
      "User request:",
      userInput,
    ].join("\n");
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
