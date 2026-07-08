import type { ContextBlock, ContextSource } from "./types";
import { estimateTokens } from "./tokenEstimate";

export interface CurrentFileSnapshot {
  path: string;
  basename: string;
  content: string;
}

export interface CurrentFileReader {
  getCurrentFileSnapshot(): Promise<CurrentFileSnapshot | null>;
}

export class CurrentFileContext implements ContextSource {
  constructor(private readonly currentFileReader: CurrentFileReader) {}

  async collect(): Promise<ContextBlock | null> {
    const file = await this.currentFileReader.getCurrentFileSnapshot();
    if (!file || !file.content.trim()) {
      return null;
    }

    return {
      id: "current-file",
      type: "current-file",
      title: file.basename,
      content: file.content,
      priority: 60,
      tokenEstimate: estimateTokens(file.content),
      sourcePath: file.path,
    };
  }
}
