import { describe, expect, it, vi } from "vitest";

import { ContextBuilder } from "./ContextBuilder";
import type { ContextBlock, ContextSource } from "./types";

describe("ContextBuilder", () => {
  it("uses selection context before current file context", async () => {
    const selection = createSource(createBlock("selection", "selection"));
    const currentFile = createSource(createBlock("current-file", "current-file"));
    const builder = new ContextBuilder({ selection, currentFile });

    const blocks = await builder.build({
      includeCurrentFile: true,
      includeSelection: true,
      tokenBudget: 100,
    });

    expect(blocks.map((block) => block.id)).toEqual(["selection"]);
    expect(currentFile.collect).not.toHaveBeenCalled();
  });

  it("falls back to current file when selection is empty", async () => {
    const selection = createSource(null);
    const currentFile = createSource(createBlock("current-file", "current-file"));
    const builder = new ContextBuilder({ selection, currentFile });

    const blocks = await builder.build({
      includeCurrentFile: true,
      includeSelection: true,
      tokenBudget: 100,
    });

    expect(blocks.map((block) => block.id)).toEqual(["current-file"]);
  });
});

function createSource(block: ContextBlock | null): ContextSource {
  return {
    collect: vi.fn(async () => block),
  };
}

function createBlock(id: string, type: "selection" | "current-file"): ContextBlock {
  return {
    id,
    type,
    title: id,
    content: "content",
    priority: type === "selection" ? 100 : 60,
    tokenEstimate: 2,
  };
}
