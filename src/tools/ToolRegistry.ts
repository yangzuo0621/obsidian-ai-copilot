import type { ToolCall, ToolDefinition } from "../providers/types";

import type { Tool, ToolConfirmationService, ToolExecutionResult } from "./types";
import { toToolDefinition } from "./types";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  constructor(tools: Tool[] = []) {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }

    this.tools.set(tool.name, tool);
  }

  getDefinitions(): ToolDefinition[] {
    return [...this.tools.values()].map(toToolDefinition);
  }

  async execute(
    call: ToolCall,
    confirmation: ToolConfirmationService,
    onStatus?: (status: "awaiting-confirmation" | "running") => void,
    signal?: AbortSignal,
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(call.function.name);
    if (!tool) {
      return errorResult(`Unknown tool: ${call.function.name}`);
    }

    try {
      const parsed: unknown = JSON.parse(call.function.arguments || "{}");
      const input = tool.validate(parsed);

      if (tool.kind === "write") {
        if (!tool.getConfirmation) {
          return errorResult(`Write tool "${tool.name}" does not define a confirmation preview.`);
        }

        onStatus?.("awaiting-confirmation");
        const approved = await confirmation.confirm(tool.getConfirmation(input), signal);
        if (!approved) {
          return {
            status: "declined",
            content: JSON.stringify({ ok: false, declined: true, message: "The user declined this write operation." }),
          };
        }
      }

      onStatus?.("running");
      const result = await tool.run(input);
      return {
        status: "succeeded",
        content: result.content,
      };
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error));
    }
  }
}

function errorResult(message: string): ToolExecutionResult {
  return {
    status: "error",
    content: JSON.stringify({ ok: false, error: message }),
    error: message,
  };
}
