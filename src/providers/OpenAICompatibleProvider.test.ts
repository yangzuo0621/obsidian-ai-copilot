import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider";

describe("OpenAICompatibleProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends chat completions requests and extracts assistant content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "returned-model",
          choices: [{ message: { content: "Hello back" } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleProvider({
      apiKey: "secret",
      baseUrl: "https://example.test/v1/",
    });

    const result = await provider.complete({
      model: "test-model",
      temperature: 0.3,
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(fetchMock).toHaveBeenCalledWith("https://example.test/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret",
      },
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "bad request" }), { status: 400 })),
    );
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
    const body = createStream([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider({
      apiKey: "secret",
      baseUrl: "https://example.test/v1/",
    });
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();
    const abortController = new AbortController();

    await provider.stream(
      {
        model: "test-model",
        temperature: 0.3,
        messages: [{ role: "user", content: "Hello" }],
      },
      { onToken, onDone, onError },
      abortController.signal,
    );

    expect(fetchMock).toHaveBeenCalledWith("https://example.test/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret",
      },
      signal: abortController.signal,
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
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("throws useful streaming errors for non-ok responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "stream bad request" }), { status: 400 })),
    );
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
        {
          onToken: vi.fn(),
          onDone: vi.fn(),
          onError: vi.fn(),
        },
      ),
    ).rejects.toThrow('Provider request failed with HTTP 400: {"error":"stream bad request"}');
  });

  it("validates required request configuration before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider({
      apiKey: "",
      baseUrl: "",
    });

    await expect(provider.complete({ model: "test-model", messages: [] })).rejects.toThrow(
      "Provider base URL is required.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function createStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}
