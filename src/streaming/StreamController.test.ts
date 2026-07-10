import { describe, expect, it, vi } from "vitest";

import type { LLMProvider } from "../providers/types";

import { StreamController } from "./StreamController";

describe("StreamController", () => {
  it("reports completion after the provider promise resolves", async () => {
    const provider = createProvider(async (_request, callbacks) => {
      callbacks.onToken("Hello");
      return { content: "Hello", toolCalls: [], finishReason: "stop" };
    });
    const callbacks = {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onAbort: vi.fn(),
      onError: vi.fn(),
    };

    await new StreamController().start({
      id: "request-1",
      provider,
      request: { model: "test", messages: [] },
      callbacks,
    });

    expect(callbacks.onToken).toHaveBeenCalledWith("Hello");
    expect(callbacks.onDone).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("reports errors rejected by the provider promise", async () => {
    const provider = createProvider(async () => {
      throw new Error("Network down");
    });
    const callbacks = {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onAbort: vi.fn(),
      onError: vi.fn(),
    };

    await new StreamController().start({
      id: "request-1",
      provider,
      request: { model: "test", messages: [] },
      callbacks,
    });

    expect(callbacks.onDone).not.toHaveBeenCalled();
    expect(callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Network down" }));
  });
});

function createProvider(stream: LLMProvider["stream"]): LLMProvider {
  return {
    id: "test",
    label: "Test",
    complete: vi.fn(),
    stream,
  };
}
