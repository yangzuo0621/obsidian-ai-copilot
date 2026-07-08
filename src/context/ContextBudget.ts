import type { ContextBlock } from "./types";
import { estimateTokens, truncateToTokenBudget } from "./tokenEstimate";

export class ContextBudget {
  apply(blocks: ContextBlock[], tokenBudget: number): ContextBlock[] {
    if (tokenBudget <= 0 || blocks.length === 0) {
      return [];
    }

    const selected: ContextBlock[] = [];
    let remainingBudget = tokenBudget;

    for (const block of [...blocks].sort(sortByPriority)) {
      if (remainingBudget <= 0) {
        break;
      }

      if (block.tokenEstimate <= remainingBudget) {
        selected.push(block);
        remainingBudget -= block.tokenEstimate;
        continue;
      }

      const truncatedContent = truncateToTokenBudget(block.content, remainingBudget);
      const truncatedTokenEstimate = estimateTokens(truncatedContent);
      if (truncatedContent.trim()) {
        selected.push({
          ...block,
          content: truncatedContent,
          tokenEstimate: truncatedTokenEstimate,
        });
      }

      remainingBudget = 0;
    }

    return selected;
  }
}

function sortByPriority(left: ContextBlock, right: ContextBlock): number {
  if (right.priority !== left.priority) {
    return right.priority - left.priority;
  }

  return left.tokenEstimate - right.tokenEstimate;
}
