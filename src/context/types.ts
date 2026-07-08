export type ContextBlockType = "selection" | "current-file" | "linked-note" | "vault-search" | "frontmatter" | "manual";

export interface ContextBlock {
  id: string;
  type: ContextBlockType;
  title: string;
  content: string;
  priority: number;
  tokenEstimate: number;
  sourcePath?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface ContextBlockSummary {
  id: string;
  type: ContextBlockType;
  title: string;
  tokenEstimate: number;
  sourcePath?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface ContextBuildOptions {
  includeCurrentFile: boolean;
  includeSelection: boolean;
  tokenBudget: number;
}

export interface ContextSource {
  collect(): Promise<ContextBlock | null>;
}

export function summarizeContextBlock(block: ContextBlock): ContextBlockSummary {
  return {
    id: block.id,
    type: block.type,
    title: block.title,
    tokenEstimate: block.tokenEstimate,
    sourcePath: block.sourcePath,
    lineStart: block.lineStart,
    lineEnd: block.lineEnd,
  };
}
