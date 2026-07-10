export interface TextChatMessage {
  role: "system" | "user";
  content: string;
}

export interface AssistantChatMessage {
  role: "assistant";
  content: string | null;
  toolCalls?: ToolCall[];
}

export interface ToolChatMessage {
  role: "tool";
  content: string;
  toolCallId: string;
}

export type ChatMessage = TextChatMessage | AssistantChatMessage | ToolChatMessage;

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

export interface CompletionResult {
  content: string;
  model?: string;
  raw: unknown;
}

export interface StreamCallbacks {
  onToken(token: string): void;
  onDone(result: StreamResult): void;
  onError(error: unknown): void;
}

export interface StreamResult {
  content: string;
  toolCalls: ToolCall[];
  finishReason?: string;
}

export interface LLMProvider {
  id: string;
  label: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
  stream(request: CompletionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<StreamResult>;
}
