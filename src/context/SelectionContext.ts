import type { ContextBlock, ContextSource } from "./types";
import { estimateTokens } from "./tokenEstimate";

export interface SelectionReader {
  getSelection(): string | null;
  getSelectionLineRange(): SelectionLineRange | null;
}

export interface SelectionLineRange {
  lineStart: number;
  lineEnd: number;
}

export interface ActiveFileReader {
  getActiveFilePath(): string | null;
}

export class SelectionContext implements ContextSource {
  constructor(
    private readonly selectionReader: SelectionReader,
    private readonly activeFileReader: ActiveFileReader,
  ) {}

  async collect(): Promise<ContextBlock | null> {
    const selection = this.selectionReader.getSelection()?.trim();
    if (!selection) {
      return null;
    }

    const sourcePath = this.activeFileReader.getActiveFilePath() ?? undefined;
    const lineRange = this.selectionReader.getSelectionLineRange();

    return {
      id: "selection",
      type: "selection",
      title: sourcePath ? `Selection in ${sourcePath}` : "Current selection",
      content: selection,
      priority: 100,
      tokenEstimate: estimateTokens(selection),
      sourcePath,
      lineStart: lineRange?.lineStart,
      lineEnd: lineRange?.lineEnd,
    };
  }
}
