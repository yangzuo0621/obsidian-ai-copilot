import { describe, expect, it } from "vitest";

import { PromptComposer } from "./PromptComposer";

describe("PromptComposer", () => {
  it("wraps context blocks in the latest user message", () => {
    const messages = new PromptComposer().compose({
      userInput: "What does this mean?",
      history: [{ role: "assistant", content: "Earlier answer" }],
      contextBlocks: [
        {
          id: "selection",
          type: "selection",
          title: "Selection in note.md",
          sourcePath: "note.md",
          content: "Selected text",
          priority: 100,
          tokenEstimate: 3,
          lineStart: 4,
          lineEnd: 6,
        },
      ],
    });

    expect(messages[0]?.role).toBe("system");
    expect(messages[1]).toEqual({ role: "assistant", content: "Earlier answer" });
    expect(messages[2]?.content).toContain('<context-block id="selection" type="selection">');
    expect(messages[2]?.content).toContain("Lines: 4-6");
    expect(messages[2]?.content).toContain("Selected text");
    expect(messages[2]?.content).toContain("User request:\nWhat does this mean?");
  });
});
