import type { SearchService, VaultSearchResult } from "../retrieval/SearchService";

import type { ContextBlock, QueryContextSource } from "./types";
import { estimateTokens } from "./tokenEstimate";

const VAULT_SEARCH_PRIORITY = 30;

export class VaultSearchContext implements QueryContextSource {
  constructor(private readonly searchService: SearchService) {}

  async collect(query: string): Promise<ContextBlock[]> {
    const results = await this.searchService.search(query);

    return results.map(toContextBlock);
  }
}

function toContextBlock(result: VaultSearchResult): ContextBlock {
  const content = result.snippet;

  return {
    id: `vault-search:${result.path}:${result.lineStart}-${result.lineEnd}`,
    type: "vault-search",
    title: result.basename,
    content,
    priority: VAULT_SEARCH_PRIORITY,
    tokenEstimate: estimateTokens(content),
    sourcePath: result.path,
    lineStart: result.lineStart,
    lineEnd: result.lineEnd,
  };
}
