import { ContextBudget } from "./ContextBudget";
import type { ContextBlock, ContextBuildOptions, ContextSource } from "./types";

export interface ContextBuilderSources {
  selection: ContextSource;
  currentFile: ContextSource;
}

export class ContextBuilder {
  constructor(
    private readonly sources: ContextBuilderSources,
    private readonly budget = new ContextBudget(),
  ) {}

  async build(options: ContextBuildOptions): Promise<ContextBlock[]> {
    const blocks: ContextBlock[] = [];

    if (options.includeSelection) {
      const selectionBlock = await this.sources.selection.collect();
      if (selectionBlock) {
        blocks.push(selectionBlock);
      }
    }

    if (blocks.length === 0 && options.includeCurrentFile) {
      const currentFileBlock = await this.sources.currentFile.collect();
      if (currentFileBlock) {
        blocks.push(currentFileBlock);
      }
    }

    return this.budget.apply(blocks, options.tokenBudget);
  }
}
