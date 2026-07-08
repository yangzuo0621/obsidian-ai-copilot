export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionResult {
  content: string;
  model?: string;
  raw: unknown;
}

export interface StreamCallbacks {
  onToken(token: string): void;
  onDone(): void;
  onError(error: unknown): void;
}

export interface LLMProvider {
  id: string;
  label: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
  stream(request: CompletionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void>;
}
