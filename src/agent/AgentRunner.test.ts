import { describe, expect, it, vi } from "vitest";

import type { LLMProvider, StreamResult } from "../providers/types";
import { ToolRegistry } from "../tools/ToolRegistry";
import type { Tool, ToolConfirmationService } from "../tools/types";
import { AgentRunner } from "./AgentRunner";

describe("AgentRunner", () => {
  it("runs a tool and sends its result back to the provider", async () => {
    const runTool = vi.fn(async () => ({ content: '{"ok":true,"value":"found"}' }));
    const registry = new ToolRegistry([createReadTool(runTool)]);
    const responses: StreamResult[] = [
      {
        content: "",
        toolCalls: [
          {
            id: "call-1",
            type: "function",
            function: { name: "read_note", arguments: '{"path":"note.md"}' },
          },
        ],
        finishReason: "tool_calls",
      },
      { content: "Found it", toolCalls: [], finishReason: "stop" },
    ];
    const stream = vi.fn(async (_request, callbacks) => {
      const response = responses.shift();
      if (!response) {
        throw new Error("No mock response");
      }
      if (response.content) {
        callbacks.onToken(response.content);
      }
      callbacks.onDone(response);
      return response;
    });
    const provider = createProvider(stream);
    const onActivity = vi.fn();
    const runner = new AgentRunner(registry, createConfirmation());

    const result = await runner.run({
      requestId: "request-1",
      provider,
      request: { model: "test", messages: [{ role: "user", content: "Read note" }] },
      callbacks: { onToken: vi.fn(), onActivity },
    });

    expect(result.content).toBe("Found it");
    expect(runTool).toHaveBeenCalledWith({ path: "note.md" });
    expect(stream).toHaveBeenCalledTimes(2);
    expect(stream.mock.calls[1]?.[0].messages).toEqual([
      { role: "user", content: "Read note" },
      {
        role: "assistant",
        content: null,
        toolCalls: [expect.objectContaining({ id: "call-1" })],
      },
      { role: "tool", toolCallId: "call-1", content: '{"ok":true,"value":"found"}' },
    ]);
    expect(onActivity).toHaveBeenLastCalledWith(expect.objectContaining({ status: "succeeded" }));
  });

  it("aborts an active provider round", async () => {
    const stream = vi.fn(
      (_request, _callbacks, signal?: AbortSignal) =>
        new Promise<StreamResult>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const runner = new AgentRunner(new ToolRegistry(), createConfirmation());
    const running = runner.run({
      requestId: "request-1",
      provider: createProvider(stream),
      request: { model: "test", messages: [] },
      callbacks: { onToken: vi.fn(), onActivity: vi.fn() },
    });

    await vi.waitFor(() => expect(stream).toHaveBeenCalledTimes(1));
    runner.abort("request-1");

    await expect(running).rejects.toMatchObject({ name: "AbortError" });
  });
});

function createReadTool(run: Tool["run"]): Tool {
  return {
    name: "read_note",
    description: "Read note",
    inputSchema: { type: "object" },
    kind: "read",
    validate: (input) => input as Record<string, unknown>,
    run,
  };
}

function createProvider(stream: LLMProvider["stream"]): LLMProvider {
  return {
    id: "test",
    label: "Test",
    complete: vi.fn(),
    stream,
  };
}

function createConfirmation(): ToolConfirmationService {
  return { confirm: vi.fn().mockResolvedValue(true) };
}
