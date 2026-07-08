import type { CompletionRequest, CompletionResult, LLMProvider, StreamCallbacks } from "./types";

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
    };
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
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
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

  async stream(request: CompletionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
    validateRequest(this.baseUrl, request);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.buildHeaders(),
      signal,
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
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

    await readServerSentEvents(response.body, (payload) => {
      if (payload === "[DONE]") {
        return;
      }

      const token = extractStreamingToken(payload);
      if (token) {
        callbacks.onToken(token);
      }
    });

    callbacks.onDone();
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

async function readServerSentEvents(body: ReadableStream<Uint8Array>, onData: (payload: string) => void): Promise<void> {
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

function extractStreamingToken(payload: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    throw new Error(`Provider returned an invalid streaming chunk: ${payload}`);
  }

  if (!isChatCompletionChunk(parsed)) {
    return null;
  }

  return parsed.choices?.map((choice) => choice.delta?.content ?? "").join("") || null;
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
