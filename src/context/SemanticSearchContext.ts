import type { EmbeddingIndexService } from "../retrieval/EmbeddingIndexService";
import type { VectorSearchResult } from "../retrieval/VectorStore";

import type { ContextBlock, QueryContextSource } from "./types";

const SEMANTIC_SEARCH_PRIORITY = 35;

export class SemanticSearchContext implements QueryContextSource {
  constructor(private readonly indexService: EmbeddingIndexService) {}

  async collect(query: string): Promise<ContextBlock[]> {
    const results = await this.indexService.search(query);

    return results.map(toContextBlock);
  }
}

function toContextBlock(result: VectorSearchResult): ContextBlock {
  return {
    id: result.chunk.id,
    type: "semantic-search",
    title: result.chunk.basename,
    content: result.chunk.content,
    priority: SEMANTIC_SEARCH_PRIORITY,
    tokenEstimate: result.chunk.tokenEstimate,
    sourcePath: result.chunk.path,
    lineStart: result.chunk.lineStart,
    lineEnd: result.chunk.lineEnd,
  };
}
