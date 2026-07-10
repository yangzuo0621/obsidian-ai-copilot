import type { ToolDefinition } from "../providers/types";

export type ToolKind = "read" | "write";

export interface ToolResult {
  content: string;
}

export interface ToolConfirmationRequest {
  toolName: string;
  title: string;
  description: string;
  preview: string;
}

export interface ToolConfirmationService {
  confirm(request: ToolConfirmationRequest, signal?: AbortSignal): Promise<boolean>;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  kind: ToolKind;
  validate(input: unknown): Record<string, unknown>;
  run(input: Record<string, unknown>): Promise<ToolResult>;
  getConfirmation?(input: Record<string, unknown>): ToolConfirmationRequest;
}

export type ToolExecutionStatus = "succeeded" | "declined" | "error";

export interface ToolExecutionResult {
  status: ToolExecutionStatus;
  content: string;
  error?: string;
}

export function toToolDefinition(tool: Tool): ToolDefinition {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}
