export type PromptMode = "chat" | "explain-selection" | "rewrite-selection" | "summarize-note";

export function getCommandInstruction(mode: PromptMode): string | null {
  switch (mode) {
    case "chat":
      return null;
    case "explain-selection":
      return [
        "Explain the selected text clearly and concisely.",
        "Focus on meaning, implications, and any important terminology.",
        "Do not rewrite the source text.",
      ].join("\n");
    case "rewrite-selection":
      return [
        "Rewrite the selected text.",
        "Preserve the original meaning unless the user request asks for a different style.",
        "Return only the rewritten text, with no preamble, labels, markdown fences, or commentary.",
      ].join("\n");
    case "summarize-note":
      return [
        "Summarize the current note clearly and concisely.",
        "Capture the main points, decisions, and action items when present.",
        "Do not invent details that are not in the note.",
      ].join("\n");
  }
}
