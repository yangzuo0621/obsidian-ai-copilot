import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentRunner } from "../agent/AgentRunner";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { ToolRegistry } from "../tools/ToolRegistry";
import type { Tool } from "../tools/types";

import { ChatService } from "./ChatService";
import { ChatStore } from "./ChatStore";
import type { ChatState } from "./types";

const providerStream = vi.hoisted(() => vi.fn());

vi.mock("../providers/ProviderFactory", () => ({
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
      sessions: [
        {
          title: "New chat",
          messageCount: 0,
        },
      ],
    });
  });

  it("streams trimmed user input and stores the assistant response", async () => {
    providerStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onToken("Assistant ");
      callbacks.onToken("reply");
      return { content: "Assistant reply", toolCalls: [], finishReason: "stop" };
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
      return { content: "Contextual answer", toolCalls: [], finishReason: "stop" };
    });
    const buildContext = vi.fn(async () => [
      {
        id: "selection",
        type: "selection" as const,
        title: "Selection in note.md",
        content: "Selected text",
        priority: 100,
        tokenEstimate: 3,
        sourcePath: "note.md",
        lineStart: 2,
        lineEnd: 4,
      },
    ]);
    const service = new ChatService(() => DEFAULT_SETTINGS, {
      build: buildContext,
    });

    await service.sendMessage("Explain this");

    expect(buildContext).toHaveBeenCalledWith({
      includeCurrentFile: DEFAULT_SETTINGS.includeCurrentFile,
      includeSelection: DEFAULT_SETTINGS.includeSelection,
      includeVaultSearch: DEFAULT_SETTINGS.includeVaultSearch,
      includeEmbeddingRetrieval: DEFAULT_SETTINGS.includeEmbeddingRetrieval,
      tokenBudget: DEFAULT_SETTINGS.contextTokenBudget,
      userInput: "Explain this",
    });
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
        resolveRequest = () => resolve({ content: "", toolCalls: [], finishReason: "stop" });
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

  it("persists chat data after a completed response", async () => {
    providerStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onToken("Saved");
      return { content: "Saved", toolCalls: [], finishReason: "stop" };
    });
    const saveChatData = vi.fn().mockResolvedValue(undefined);
    const service = new ChatService(() => DEFAULT_SETTINGS, undefined, new ChatStore(), saveChatData);

    await service.sendMessage("Remember this");

    expect(saveChatData).toHaveBeenCalledWith({
      activeSessionId: service.getState().activeSessionId,
      sessions: [
        expect.objectContaining({
          title: "Remember this",
          messages: [
            expect.objectContaining({ role: "user", content: "Remember this" }),
            expect.objectContaining({ role: "assistant", content: "Saved", status: "done" }),
          ],
        }),
      ],
    });
  });

  it("creates, switches, and deletes sessions", async () => {
    const saveChatData = vi.fn().mockResolvedValue(undefined);
    const service = new ChatService(() => DEFAULT_SETTINGS, undefined, new ChatStore(), saveChatData);
    const firstSessionId = service.getState().activeSessionId;

    await service.createSession();
    const secondSessionId = service.getState().activeSessionId;

    expect(secondSessionId).not.toBe(firstSessionId);
    expect(service.getState().sessions).toHaveLength(2);

    await service.switchSession(firstSessionId);
    expect(service.getState().activeSessionId).toBe(firstSessionId);

    await service.deleteSession(firstSessionId);
    expect(service.getState().activeSessionId).toBe(secondSessionId);
    expect(service.getState().sessions).toHaveLength(1);
    expect(saveChatData).toHaveBeenCalledTimes(3);
  });

  it("keeps session histories isolated when switching sessions", async () => {
    providerStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onToken("Reply");
      return { content: "Reply", toolCalls: [], finishReason: "stop" };
    });
    const service = new ChatService(() => DEFAULT_SETTINGS);
    const firstSessionId = service.getState().activeSessionId;

    await service.sendMessage("First session");
    await service.createSession();
    await service.sendMessage("Second session");

    expect(service.getState().session.messages[0]?.content).toBe("Second session");

    await service.switchSession(firstSessionId);

    expect(service.getState().session.messages[0]?.content).toBe("First session");
  });

  it("runs tools only after agent mode is explicitly enabled", async () => {
    const runTool = vi.fn(async () => ({ content: '{"ok":true,"content":"Note body"}' }));
    const tool: Tool = {
      name: "read_note",
      description: "Read note",
      inputSchema: { type: "object" },
      kind: "read",
      validate: (input) => input as Record<string, unknown>,
      run: runTool,
    };
    let round = 0;
    providerStream.mockImplementation(async (_request, callbacks) => {
      round += 1;
      if (round === 1) {
        const result = {
          content: "",
          toolCalls: [
            {
              id: "call-1",
              type: "function" as const,
              function: { name: "read_note", arguments: '{"path":"note.md"}' },
            },
          ],
          finishReason: "tool_calls",
        };
        return result;
      }
      const result = { content: "The note says hello.", toolCalls: [], finishReason: "stop" };
      callbacks.onToken(result.content);
      return result;
    });
    const runner = new AgentRunner(new ToolRegistry([tool]), { confirm: vi.fn().mockResolvedValue(true) });
    const service = new ChatService(() => DEFAULT_SETTINGS, undefined, new ChatStore(), undefined, runner);

    service.setMode("agent");
    await service.sendMessage("Read note.md");

    expect(service.getState()).toMatchObject({
      mode: "agent",
      session: {
        messages: [
          { role: "user", content: "Read note.md" },
          {
            role: "assistant",
            content: "The note says hello.",
            status: "done",
            toolActivities: [{ toolName: "read_note", status: "succeeded" }],
          },
        ],
      },
    });
    expect(runTool).toHaveBeenCalledWith({ path: "note.md" });
    expect(providerStream.mock.calls[0]?.[0].messages[0]).toEqual({
      role: "system",
      content: expect.stringContaining("Agent mode is enabled"),
    });
    expect(providerStream.mock.calls[1]?.[0].messages.at(-1)).toMatchObject({
      role: "tool",
      toolCallId: "call-1",
    });
  });
});
