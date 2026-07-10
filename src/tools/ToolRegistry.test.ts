import { describe, expect, it, vi } from "vitest";

import type { ToolCall } from "../providers/types";
import { ToolRegistry } from "./ToolRegistry";
import type { Tool, ToolConfirmationService } from "./types";

describe("ToolRegistry", () => {
  it("executes read tools without asking for confirmation", async () => {
    const run = vi.fn(async () => ({ content: '{"ok":true}' }));
    const confirmation = createConfirmation(true);
    const registry = new ToolRegistry([createTool("read", run)]);

    const result = await registry.execute(createCall(), confirmation);

    expect(result.status).toBe("succeeded");
    expect(run).toHaveBeenCalledWith({ value: "hello" });
    expect(confirmation.confirm).not.toHaveBeenCalled();
  });

  it("does not execute a declined write tool", async () => {
    const run = vi.fn(async () => ({ content: '{"ok":true}' }));
    const confirmation = createConfirmation(false);
    const registry = new ToolRegistry([createTool("write", run)]);

    const result = await registry.execute(createCall(), confirmation);

    expect(result.status).toBe("declined");
    expect(run).not.toHaveBeenCalled();
    expect(confirmation.confirm).toHaveBeenCalledTimes(1);
  });

  it("returns tool errors for unknown tools and malformed arguments", async () => {
    const registry = new ToolRegistry();
    const confirmation = createConfirmation(true);

    await expect(registry.execute(createCall(), confirmation)).resolves.toMatchObject({
      status: "error",
      error: "Unknown tool: example_tool",
    });

    const registered = new ToolRegistry([createTool("read", vi.fn())]);
    await expect(
      registered.execute({ ...createCall(), function: { name: "example_tool", arguments: "{" } }, confirmation),
    ).resolves.toMatchObject({ status: "error" });
  });
});

function createTool(kind: Tool["kind"], run: Tool["run"]): Tool {
  return {
    name: "example_tool",
    description: "Example",
    inputSchema: { type: "object" },
    kind,
    validate(input) {
      if (typeof input !== "object" || input === null) {
        throw new Error("Invalid input");
      }
      return input as Record<string, unknown>;
    },
    run,
    getConfirmation: () => ({
      toolName: "example_tool",
      title: "Confirm",
      description: "Confirm write",
      preview: "preview",
    }),
  };
}

function createCall(): ToolCall {
  return {
    id: "call-1",
    type: "function",
    function: { name: "example_tool", arguments: '{"value":"hello"}' },
  };
}

function createConfirmation(approved: boolean): ToolConfirmationService & { confirm: ReturnType<typeof vi.fn> } {
  return {
    confirm: vi.fn().mockResolvedValue(approved),
  };
}
