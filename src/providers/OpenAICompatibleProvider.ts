import type {
  ChatMessage,
  CompletionRequest,
  CompletionResult,
  LLMProvider,
  StreamCallbacks,
  StreamResult,
  ToolCall,
} from "./types";

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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: request.model,
        messages: serializeMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools,
      }),
    });

    const responseBody: unknown = await parseResponseBody(response);

    if (!response.ok) {
      throw new Error(`Provider request failed with HTTP ${response.status}: ${formatErrorBody(responseBody)}`);
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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.buildHeaders(),
      signal,
      body: JSON.stringify({
        model: request.model,
        messages: serializeMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      const responseBody = await parseResponseBody(response);
      throw new Error(`Provider request failed with HTTP ${response.status}: ${formatErrorBody(responseBody)}`);
    }

    if (!response.body) {
      throw new Error("Provider streaming response did not include a readable body.");
    }

    const accumulator = new StreamAccumulator();
    await readServerSentEvents(response.body, (payload) => {
      if (payload === "[DONE]") {
        return;
      }

      const token = accumulator.add(payload);
      if (token) {
        callbacks.onToken(token);
      }
    });

    const result = accumulator.result();
    callbacks.onDone(result);
    return result;
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

function validateRequest(baseUrl: string, request: CompletionRequest): void {
  if (!baseUrl) {
    throw new Error("Provider base URL is required.");
  }

  if (!request.model) {
    throw new Error("Model is required.");
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function readServerSentEvents(
  body: ReadableStream<Uint8Array>,
  onData: (payload: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      processServerSentEventLine(line, onData);
    }
  }

  buffer += decoder.decode();
  if (buffer) {
    for (const line of buffer.split(/\r?\n/)) {
      processServerSentEventLine(line, onData);
    }
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

function formatErrorBody(responseBody: unknown): string {
  if (typeof responseBody === "string") {
    return responseBody;
  }

  try {
    return JSON.stringify(responseBody);
  } catch {
    return "Unable to serialize error response.";
  }
}

function serializeMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => {
    if (message.role === "assistant") {
      return {
        role: message.role,
        content: message.content,
        tool_calls: message.toolCalls?.map((call) => ({
          id: call.id,
          type: call.type,
          function: call.function,
        })),
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
