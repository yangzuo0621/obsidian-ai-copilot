import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../settings/defaults";

import { ChatService } from "./ChatService";
import type { ChatState } from "./types";

const providerStream = vi.hoisted(() => vi.fn());

vi.mock("../providers/ProviderRegistry", () => ({
  createProvider: () => ({
    id: "test-provider",
    label: "Test provider",
    complete: vi.fn(),
    stream: providerStream,
  }),
}));

describe("ChatService", () => {
  beforeEach(() => {
    providerStream.mockReset();
  });

  it("notifies subscribers with the initial state", () => {
    const service = new ChatService(() => DEFAULT_SETTINGS);
    const listener = vi.fn();

    service.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      isSending: false,
      contextBlocks: [],
      session: {
        title: "New chat",
        messages: [],
      },
    });
  });

  it("streams trimmed user input and stores the assistant response", async () => {
    providerStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onToken("Assistant ");
      callbacks.onToken("reply");
      callbacks.onDone();
    });
    const service = new ChatService(() => ({
      ...DEFAULT_SETTINGS,
      model: "test-model",
      temperature: 0.2,
    }));
    const states: ChatState[] = [];
    service.subscribe((state) => states.push(state));

    await service.sendMessage("  Hello model  ");

    expect(providerStream).toHaveBeenCalledWith(
      {
        model: "test-model",
        temperature: 0.2,
        messages: [
          { role: "system", content: expect.stringContaining("Obsidian") },
          { role: "user", content: "Hello model" },
        ],
      },
      expect.any(Object),
      expect.any(AbortSignal),
    );
    expect(service.getState()).toMatchObject({
      isSending: false,
      session: {
        title: "Hello model",
        messages: [
          { role: "user", content: "Hello model", status: "done" },
          { role: "assistant", content: "Assistant reply", status: "done" },
        ],
      },
    });
    expect(states.some((state) => state.isSending)).toBe(true);
    expect(states.some((state) => state.session.messages[1]?.status === "streaming")).toBe(true);
  });

  it("records provider failures on the assistant message", async () => {
    providerStream.mockRejectedValue(new Error("Network down"));
    const service = new ChatService(() => DEFAULT_SETTINGS);

    await service.sendMessage("Hello");

    expect(service.getState().session.messages[1]).toMatchObject({
      role: "assistant",
      content: "The provider request failed.",
      status: "error",
      error: "Network down",
    });
  });

  it("injects context into the provider request and state", async () => {
    providerStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onToken("Contextual answer");
      callbacks.onDone();
    });
    const service = new ChatService(() => DEFAULT_SETTINGS, {
      build: async () => [
        {
          id: "selection",
          type: "selection",
          title: "Selection in note.md",
          content: "Selected text",
          priority: 100,
          tokenEstimate: 3,
          sourcePath: "note.md",
          lineStart: 2,
          lineEnd: 4,
        },
      ],
    });

    await service.sendMessage("Explain this");

    expect(providerStream.mock.calls[0]?.[0].messages.at(-1)).toEqual({
      role: "user",
      content: expect.stringContaining("Selected text"),
    });
    expect(service.getState().contextBlocks).toEqual([
      {
        id: "selection",
        type: "selection",
        title: "Selection in note.md",
        tokenEstimate: 3,
        sourcePath: "note.md",
        lineStart: 2,
        lineEnd: 4,
      },
    ]);
    expect(service.getState().session.messages[0]?.contextBlocks).toEqual(service.getState().contextBlocks);
  });

  it("ignores empty messages", async () => {
    const service = new ChatService(() => DEFAULT_SETTINGS);

    await service.sendMessage("   ");

    expect(providerStream).not.toHaveBeenCalled();
    expect(service.getState().session.messages).toEqual([]);
  });

  it("ignores a second send while a request is in flight", async () => {
    let resolveRequest!: () => void;
    providerStream.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = () => resolve(undefined);
      }),
    );
    const service = new ChatService(() => DEFAULT_SETTINGS);

    const firstSend = service.sendMessage("First");
    await service.sendMessage("Second");
    resolveRequest();
    await firstSend;

    expect(providerStream).toHaveBeenCalledTimes(1);
    expect(service.getState().session.messages[0]?.content).toBe("First");
  });

  it("stops an active streamed response", async () => {
    providerStream.mockImplementation(
      (_request, callbacks, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          callbacks.onToken("Partial");
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const service = new ChatService(() => DEFAULT_SETTINGS);

    const send = service.sendMessage("Hello");
    await vi.waitFor(() => {
      expect(service.getState().session.messages[1]).toMatchObject({
        content: "Partial",
        status: "streaming",
      });
    });

    service.stopGeneration();
    await send;

    expect(service.getState()).toMatchObject({
      isSending: false,
      session: {
        messages: [
          { role: "user", content: "Hello", status: "done" },
          { role: "assistant", content: "Partial", status: "aborted" },
        ],
      },
    });
  });
});
