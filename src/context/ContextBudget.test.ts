import { describe, expect, it } from "vitest";

import { ContextBudget } from "./ContextBudget";
import type { ContextBlock } from "./types";

describe("ContextBudget", () => {
  it("keeps higher-priority blocks first", () => {
    const budget = new ContextBudget();
    const blocks: ContextBlock[] = [
      createBlock("current-file", 60, "Long current file content"),
      createBlock("selection", 100, "Selected text"),
    ];

    expect(budget.apply(blocks, 100).map((block) => block.id)).toEqual(["selection", "current-file"]);
  });

  it("truncates a block that exceeds the remaining budget", () => {
    const budget = new ContextBudget();
    const [block] = budget.apply([createBlock("current-file", 60, "a".repeat(100))], 5);

    expect(block?.content).toContain("Context truncated");
    expect(block?.tokenEstimate).toBeGreaterThan(0);
  });
});

function createBlock(id: string, priority: number, content: string): ContextBlock {
  return {
    id,
    type: id === "selection" ? "selection" : "current-file",
    title: id,
    content,
    priority,
    tokenEstimate: Math.ceil(content.length / 4),
  };
}
