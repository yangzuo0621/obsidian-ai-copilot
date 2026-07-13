import type {
  ChatMessage,
  CompletionRequest,
  CompletionResult,
  LLMProvider,
  StreamCallbacks,
  StreamResult,
  ToolCall,
} from "./types";
import { requestUrl } from "obsidian";
import type { RequestUrlResponse } from "obsidian";

import { formatHttpErrorBody, parseHttpResponseBody } from "./http";

interface OpenAICompatibleProviderOptions {
  apiKey: string;
  baseUrl: string;
}

interface OpenAIChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface OpenAIChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
        extra_content?: unknown;
      }>;
    };
    finish_reason?: string | null;
  }>;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id = "openai-compatible";
  readonly label = "OpenAI-compatible";

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    validateRequest(this.baseUrl, request);

    const response = await requestUrl({
      url: `${this.baseUrl}/chat/completions`,
      method: "POST",
      contentType: "application/json",
      headers: this.buildHeaders(),
      throw: false,
      body: JSON.stringify({
        model: request.model,
        messages: serializeMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools,
      }),
    });

    const responseBody = await parseHttpResponseBody(response);

    if (!isOkStatus(response.status)) {
      throw new Error(`Provider request failed with HTTP ${response.status}: ${formatHttpErrorBody(responseBody)}`);
    }

    const content = extractAssistantContent(responseBody);
    if (!content) {
      throw new Error("Provider response did not include assistant content.");
    }

    return {
      content,
      model: isChatCompletionResponse(responseBody) ? responseBody.model : undefined,
      raw: responseBody,
    };
  }

  async stream(request: CompletionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<StreamResult> {
    validateRequest(this.baseUrl, request);
    throwIfAborted(signal);

    const response = await requestUrl({
      url: `${this.baseUrl}/chat/completions`,
      method: "POST",
      contentType: "application/json",
      headers: this.buildHeaders(),
      throw: false,
      body: JSON.stringify({
        model: request.model,
        messages: serializeMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools,
        stream: true,
      }),
    });
    throwIfAborted(signal);

    if (!isOkStatus(response.status)) {
      const responseBody = await parseHttpResponseBody(response);
      throw new Error(`Provider request failed with HTTP ${response.status}: ${formatHttpErrorBody(responseBody)}`);
    }

    const accumulator = new StreamAccumulator();
    readServerSentEventText(response.text, (payload) => {
      throwIfAborted(signal);
      if (payload === "[DONE]") {
        return;
      }

      const token = accumulator.add(payload);
      if (token) {
        callbacks.onToken(token);
      }
    });

    return accumulator.result();
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
  }
}

function isOkStatus(status: RequestUrlResponse["status"]): boolean {
  return status >= 200 && status < 300;
}

function validateRequest(baseUrl: string, request: CompletionRequest): void {
  if (!baseUrl) {
    throw new Error("Provider base URL is required.");
  }

  if (!request.model) {
    throw new Error("Model is required.");
  }
}

function readServerSentEventText(text: string, onData: (payload: string) => void): void {
  for (const line of text.split(/\r?\n/)) {
    processServerSentEventLine(line, onData);
  }
}

function processServerSentEventLine(line: string, onData: (payload: string) => void): void {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) {
    return;
  }

  onData(trimmed.slice("data:".length).trim());
}

class StreamAccumulator {
  private content = "";
  private finishReason: string | undefined;
  private readonly toolCalls = new Map<number, ToolCall>();

  add(payload: string): string | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload) as unknown;
    } catch {
      throw new Error(`Provider returned an invalid streaming chunk: ${payload}`);
    }

    if (!isChatCompletionChunk(parsed)) {
      return null;
    }

    let token = "";
    for (const choice of parsed.choices ?? []) {
      token += choice.delta?.content ?? "";
      this.finishReason = choice.finish_reason ?? this.finishReason;

      for (const delta of choice.delta?.tool_calls ?? []) {
        const index = delta.index ?? 0;
        const existing = this.toolCalls.get(index) ?? {
          id: "",
          type: "function" as const,
          function: { name: "", arguments: "" },
        };
        existing.id = delta.id ?? existing.id;
        if (delta.type === "function") {
          existing.type = delta.type;
        }
        preserveGeminiThoughtSignature(existing, delta.extra_content);
        existing.function.name += delta.function?.name ?? "";
        existing.function.arguments += delta.function?.arguments ?? "";
        this.toolCalls.set(index, existing);
      }
    }

    this.content += token;
    return token || null;
  }

  result(): StreamResult {
    return {
      content: this.content,
      toolCalls: [...this.toolCalls.entries()].sort(([left], [right]) => left - right).map(([, call]) => call),
      finishReason: this.finishReason,
    };
  }
}

function preserveGeminiThoughtSignature(target: ToolCall, extraContent: unknown): void {
  if (!hasGeminiThoughtSignature(extraContent)) {
    return;
  }

  target.extra_content = {
    google: {
      thought_signature: extraContent.google.thought_signature,
    },
  };
}

function hasGeminiThoughtSignature(value: unknown): value is { google: { thought_signature: string } } {
  if (typeof value !== "object" || value === null || !("google" in value)) {
    return false;
  }

  const google = value.google;
  return (
    typeof google === "object" &&
    google !== null &&
    "thought_signature" in google &&
    typeof google.thought_signature === "string"
  );
}

function extractAssistantContent(responseBody: unknown): string | null {
  if (!isChatCompletionResponse(responseBody)) {
    return null;
  }

  return responseBody.choices?.[0]?.message?.content ?? null;
}

function isChatCompletionResponse(value: unknown): value is OpenAIChatCompletionResponse {
  return typeof value === "object" && value !== null;
}

function isChatCompletionChunk(value: unknown): value is OpenAIChatCompletionChunk {
  return typeof value === "object" && value !== null;
}

function serializeMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => {
    if (message.role === "assistant") {
      return {
        role: message.role,
        content: message.content,
        tool_calls: message.toolCalls?.map(serializeToolCall),
      };
    }

    if (message.role === "tool") {
      return {
        role: message.role,
        content: message.content,
        tool_call_id: message.toolCallId,
      };
    }

    return { role: message.role, content: message.content };
  });
}

function serializeToolCall(call: ToolCall): Record<string, unknown> {
  return {
    id: call.id,
    type: call.type,
    function: {
      name: call.function.name,
      arguments: call.function.arguments,
    },
    ...(call.extra_content ? { extra_content: call.extra_content } : {}),
  };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  throw new DOMException("The operation was aborted.", "AbortError");
}
