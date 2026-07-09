import type { TFile } from "obsidian";

export interface MarkdownFileReader {
  listMarkdownFiles(): TFile[];
  readMarkdownFile(file: TFile): Promise<string>;
}

export interface VaultSearchResult {
  path: string;
  basename: string;
  snippet: string;
  score: number;
  lineStart: number;
  lineEnd: number;
}

export interface VaultSearchOptions {
  maxResults?: number;
  snippetLineRadius?: number;
}

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_SNIPPET_LINE_RADIUS = 2;
const MAX_QUERY_TERMS = 8;
const MIN_TERM_LENGTH = 2;
const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "how",
  "into",
  "my",
  "our",
  "say",
  "the",
  "this",
  "that",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "请",
  "我",
  "的",
  "了",
  "和",
  "是",
  "在",
  "吗",
]);

export class SearchService {
  constructor(private readonly files: MarkdownFileReader) {}

  async search(query: string, options: VaultSearchOptions = {}): Promise<VaultSearchResult[]> {
    const terms = extractSearchTerms(query);
    if (terms.length === 0) {
      return [];
    }

    const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
    const snippetLineRadius = options.snippetLineRadius ?? DEFAULT_SNIPPET_LINE_RADIUS;
    const results: VaultSearchResult[] = [];

    for (const file of this.files.listMarkdownFiles()) {
      const content = await this.files.readMarkdownFile(file);
      const result = scoreFile(file, content, terms, snippetLineRadius);
      if (result) {
        results.push(result);
      }
    }

    return results.sort(sortResults).slice(0, maxResults);
  }
}

export function extractSearchTerms(query: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  const matches = query.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];

  for (const match of matches) {
    const term = match.trim();
    if (term.length < MIN_TERM_LENGTH || STOP_WORDS.has(term) || seen.has(term)) {
      continue;
    }

    seen.add(term);
    terms.push(term);
    if (terms.length >= MAX_QUERY_TERMS) {
      break;
    }
  }

  return terms;
}

function scoreFile(file: TFile, content: string, terms: string[], snippetLineRadius: number): VaultSearchResult | null {
  const path = file.path;
  const basename = file.basename;
  const lowerPath = path.toLowerCase();
  const lowerBasename = basename.toLowerCase();
  const lines = content.split(/\r?\n/);
  let score = 0;
  let bestLineIndex = -1;
  let bestLineScore = 0;

  for (const term of terms) {
    if (lowerBasename.includes(term)) {
      score += 10;
    } else if (lowerPath.includes(term)) {
      score += 5;
    }
  }

  lines.forEach((line, index) => {
    const lineScore = scoreLine(line, terms);
    if (lineScore > 0) {
      score += lineScore;
    }

    if (lineScore > bestLineScore) {
      bestLineScore = lineScore;
      bestLineIndex = index;
    }
  });

  if (score === 0) {
    return null;
  }

  const snippetRange = createSnippetRange(lines, bestLineIndex, snippetLineRadius);
  return {
    path,
    basename,
    snippet: lines
      .slice(snippetRange.start, snippetRange.end + 1)
      .join("\n")
      .trim(),
    score,
    lineStart: snippetRange.start + 1,
    lineEnd: snippetRange.end + 1,
  };
}

function scoreLine(line: string, terms: string[]): number {
  const lowerLine = line.toLowerCase();
  let score = 0;

  for (const term of terms) {
    const matches = lowerLine.matchAll(new RegExp(escapeRegExp(term), "g"));
    score += [...matches].length;
  }

  return score;
}

function createSnippetRange(lines: string[], bestLineIndex: number, radius: number): { start: number; end: number } {
  if (bestLineIndex < 0) {
    return {
      start: 0,
      end: Math.min(lines.length - 1, Math.max(0, radius * 2)),
    };
  }

  return {
    start: Math.max(0, bestLineIndex - radius),
    end: Math.min(lines.length - 1, bestLineIndex + radius),
  };
}

function sortResults(left: VaultSearchResult, right: VaultSearchResult): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.path.localeCompare(right.path);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
