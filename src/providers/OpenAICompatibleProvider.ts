import type { CompletionRequest, CompletionResult, LLMProvider } from "./types";

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
    if (!this.baseUrl) {
      throw new Error("Provider base URL is required.");
    }

    if (!request.model) {
      throw new Error("Model is required.");
    }

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

function extractAssistantContent(responseBody: unknown): string | null {
  if (!isChatCompletionResponse(responseBody)) {
    return null;
  }

  return responseBody.choices?.[0]?.message?.content ?? null;
}

function isChatCompletionResponse(value: unknown): value is OpenAIChatCompletionResponse {
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
