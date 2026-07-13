import { requestUrl } from "obsidian";
import type { RequestUrlParam, RequestUrlResponse } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider";

vi.mock("obsidian", () => ({
  requestUrl: vi.fn(),
}));

const requestUrlMock = vi.mocked(requestUrl);

describe("OpenAICompatibleProvider", () => {
  afterEach(() => {
    requestUrlMock.mockReset();
  });

  it("sends chat completions requests and extracts assistant content", async () => {
    requestUrlMock.mockResolvedValue(
      createResponse(
        JSON.stringify({
          model: "returned-model",
          choices: [{ message: { content: "Hello back" } }],
        }),
      ),
    );

    const provider = new OpenAICompatibleProvider({
      apiKey: "secret",
      baseUrl: "https://example.test/v1/",
    });

    const result = await provider.complete({
      model: "test-model",
      temperature: 0.3,
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(requestUrlMock).toHaveBeenCalledWith({
      url: "https://example.test/v1/chat/completions",
      method: "POST",
      contentType: "application/json",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret",
      },
      throw: false,
      body: JSON.stringify({
        model: "test-model",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 0.3,
        max_tokens: undefined,
      }),
    });
    expect(result).toMatchObject({
      content: "Hello back",
      model: "returned-model",
    });
  });

  it("throws a useful error for non-ok responses", async () => {
    requestUrlMock.mockResolvedValue(createResponse(JSON.stringify({ error: "bad request" }), 400));
    const provider = new OpenAICompatibleProvider({
      apiKey: "",
      baseUrl: "https://example.test/v1",
    });

    await expect(
      provider.complete({
        model: "test-model",
        messages: [],
      }),
    ).rejects.toThrow('Provider request failed with HTTP 400: {"error":"bad request"}');
  });

  it("streams chat completion tokens from server-sent events", async () => {
    requestUrlMock.mockResolvedValue(
      createResponse(
        [
          'data: {"choices":[{"delta":{"content":"Hel"}}]}',
          "",
          'data: {"choices":[{"delta":{"content":"lo"}}]}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
      ),
    );
    const provider = new OpenAICompatibleProvider({
      apiKey: "secret",
      baseUrl: "https://example.test/v1/",
    });
    const onToken = vi.fn();

    const result = await provider.stream(
      {
        model: "test-model",
        temperature: 0.3,
        messages: [{ role: "user", content: "Hello" }],
      },
      { onToken },
      new AbortController().signal,
    );

    expect(requestUrlMock).toHaveBeenCalledWith({
      url: "https://example.test/v1/chat/completions",
      method: "POST",
      contentType: "application/json",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret",
      },
      throw: false,
      body: JSON.stringify({
        model: "test-model",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 0.3,
        max_tokens: undefined,
        stream: true,
      }),
    });
    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenNthCalledWith(1, "Hel");
    expect(onToken).toHaveBeenNthCalledWith(2, "lo");
    expect(result.content).toBe("Hello");
  });

  it("throws useful streaming errors for non-ok responses", async () => {
    requestUrlMock.mockResolvedValue(createResponse(JSON.stringify({ error: "stream bad request" }), 400));
    const provider = new OpenAICompatibleProvider({
      apiKey: "",
      baseUrl: "https://example.test/v1",
    });

    await expect(
      provider.stream(
        {
          model: "test-model",
          messages: [],
        },
        { onToken: vi.fn() },
      ),
    ).rejects.toThrow('Provider request failed with HTTP 400: {"error":"stream bad request"}');
  });

  it("reconstructs streamed tool calls by index", async () => {
    requestUrlMock.mockResolvedValue(
      createResponse(
        [
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","type":"function","function":{"name":"read_","arguments":""}}]}}]}',
          "",
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"note","arguments":"{\\"path\\":\\"note"}}]}}]}',
          "",
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":".md\\"}"}}]},"finish_reason":"tool_calls"}]}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
      ),
    );
    const provider = new OpenAICompatibleProvider({ apiKey: "", baseUrl: "https://example.test/v1" });

    const result = await provider.stream(
      {
        model: "test-model",
        messages: [{ role: "user", content: "Read note" }],
        tools: [
          {
            type: "function",
            function: { name: "read_note", description: "Read note", parameters: { type: "object" } },
          },
        ],
      },
      { onToken: vi.fn() },
    );

    expect(result).toEqual({
      content: "",
      finishReason: "tool_calls",
      toolCalls: [
        {
          id: "call-1",
          type: "function",
          function: { name: "read_note", arguments: '{"path":"note.md"}' },
        },
      ],
    });
  });

  it("preserves provider-specific streamed tool call metadata", async () => {
    requestUrlMock.mockResolvedValue(
      createResponse(
        [
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","type":"function","ignored_provider_field":"drop-me","extra_content":{"google":{"thought_signature":"gemini-signature"}},"function":{"name":"read_","arguments":""}}]}}]}',
          "",
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"note","arguments":"{\\"path\\":\\"note.md\\"}"}}]},"finish_reason":"tool_calls"}]}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
      ),
    );
    const provider = new OpenAICompatibleProvider({ apiKey: "", baseUrl: "https://example.test/v1" });

    const result = await provider.stream(
      {
        model: "test-model",
        messages: [{ role: "user", content: "Read note" }],
        tools: [
          {
            type: "function",
            function: { name: "read_note", description: "Read note", parameters: { type: "object" } },
          },
        ],
      },
      { onToken: vi.fn() },
    );

    expect(result.toolCalls).toEqual([
      {
        id: "call-1",
        type: "function",
        extra_content: {
          google: {
            thought_signature: "gemini-signature",
          },
        },
        function: {
          name: "read_note",
          arguments: '{"path":"note.md"}',
        },
      },
    ]);
  });

  it("serializes assistant tool call metadata for provider continuation", async () => {
    requestUrlMock.mockResolvedValue(
      createResponse(
        ['data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}', "", "data: [DONE]", ""].join("\n"),
      ),
    );
    const provider = new OpenAICompatibleProvider({ apiKey: "", baseUrl: "https://example.test/v1" });

    await provider.stream(
      {
        model: "test-model",
        messages: [
          {
            role: "assistant",
            content: null,
            toolCalls: [
              {
                id: "call-1",
                type: "function",
                extra_content: {
                  google: {
                    thought_signature: "gemini-signature",
                  },
                },
                function: {
                  name: "read_note",
                  arguments: '{"path":"note.md"}',
                },
              },
            ],
          },
        ],
      },
      { onToken: vi.fn() },
    );

    const requestBody = JSON.parse(String(getFirstRequestParam().body));
    expect(requestBody.messages[0].tool_calls).toEqual([
      {
        id: "call-1",
        type: "function",
        extra_content: {
          google: {
            thought_signature: "gemini-signature",
          },
        },
        function: {
          name: "read_note",
          arguments: '{"path":"note.md"}',
        },
      },
    ]);
  });

  it("does not serialize arbitrary provider-specific tool call metadata", async () => {
    requestUrlMock.mockResolvedValue(
      createResponse(
        ['data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}', "", "data: [DONE]", ""].join("\n"),
      ),
    );
    const provider = new OpenAICompatibleProvider({ apiKey: "", baseUrl: "https://example.test/v1" });

    await provider.stream(
      {
        model: "test-model",
        messages: [
          {
            role: "assistant",
            content: null,
            toolCalls: [
              {
                id: "call-1",
                type: "function",
                ignored_provider_field: "drop-me",
                function: {
                  name: "read_note",
                  arguments: '{"path":"note.md"}',
                  ignored_function_field: "drop-me",
                },
              } as never,
            ],
          },
        ],
      },
      { onToken: vi.fn() },
    );

    const requestBody = JSON.parse(String(getFirstRequestParam().body));
    expect(requestBody.messages[0].tool_calls).toEqual([
      {
        id: "call-1",
        type: "function",
        function: {
          name: "read_note",
          arguments: '{"path":"note.md"}',
        },
      },
    ]);
  });

  it("validates required request configuration before request", async () => {
    const provider = new OpenAICompatibleProvider({
      apiKey: "",
      baseUrl: "",
    });

    await expect(provider.complete({ model: "test-model", messages: [] })).rejects.toThrow(
      "Provider base URL is required.",
    );
    expect(requestUrlMock).not.toHaveBeenCalled();
  });

  it("does not process streamed text when the signal is already aborted", async () => {
    const provider = new OpenAICompatibleProvider({ apiKey: "", baseUrl: "https://example.test/v1" });
    const abortController = new AbortController();
    abortController.abort();

    await expect(
      provider.stream({ model: "test-model", messages: [] }, { onToken: vi.fn() }, abortController.signal),
    ).rejects.toThrow("The operation was aborted.");
    expect(requestUrlMock).not.toHaveBeenCalled();
  });
});

function createResponse(text: string, status = 200): RequestUrlResponse {
  return {
    status,
    headers: {},
    arrayBuffer: new TextEncoder().encode(text).buffer,
    json: tryParseJson(text),
    text,
  };
}

function getFirstRequestParam(): RequestUrlParam {
  const [request] = requestUrlMock.mock.calls[0] ?? [];
  if (typeof request !== "object" || request === null) {
    throw new Error("Expected requestUrl to be called with request params.");
  }

  return request;
}

function tryParseJson(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
