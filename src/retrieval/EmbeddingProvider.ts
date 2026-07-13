import { requestUrl } from "obsidian";

import { formatHttpErrorBody, parseHttpResponseBody } from "../providers/http";

export interface EmbeddingProvider {
  embed(input: string): Promise<number[]>;
  embedMany(inputs: string[]): Promise<number[][]>;
}

interface OpenAICompatibleEmbeddingProviderOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface OpenAIEmbeddingResponse {
  data?: Array<{
    embedding?: number[];
    index?: number;
  }>;
}

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: OpenAICompatibleEmbeddingProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.model = options.model;
  }

  async embed(input: string): Promise<number[]> {
    const [embedding] = await this.embedMany([input]);
    if (!embedding) {
      throw new Error("Embedding provider did not return an embedding.");
    }

    return embedding;
  }

  async embedMany(inputs: string[]): Promise<number[][]> {
    validateEmbeddingRequest(this.baseUrl, this.model, inputs);

    const response = await requestUrl({
      url: `${this.baseUrl}/embeddings`,
      method: "POST",
      contentType: "application/json",
      headers: this.buildHeaders(),
      throw: false,
      body: JSON.stringify({
        model: this.model,
        input: inputs,
      }),
    });

    const responseBody = await parseHttpResponseBody(response);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Embedding request failed with HTTP ${response.status}: ${formatHttpErrorBody(responseBody)}`);
    }

    if (!isEmbeddingResponse(responseBody) || !responseBody.data) {
      throw new Error("Embedding provider response did not include embedding data.");
    }

    const byIndex = [...responseBody.data].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
    const embeddings = byIndex.map((item) => item.embedding);
    if (embeddings.length !== inputs.length || embeddings.some((embedding) => !isNumberArray(embedding))) {
      throw new Error("Embedding provider returned an unexpected number of embeddings.");
    }

    return embeddings as number[][];
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

function validateEmbeddingRequest(baseUrl: string, model: string, inputs: string[]): void {
  if (!baseUrl) {
    throw new Error("Provider base URL is required.");
  }

  if (!model) {
    throw new Error("Embedding model is required.");
  }

  if (inputs.length === 0 || inputs.some((input) => input.trim().length === 0)) {
    throw new Error("Embedding input is required.");
  }
}

function isEmbeddingResponse(value: unknown): value is OpenAIEmbeddingResponse {
  return typeof value === "object" && value !== null;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}
