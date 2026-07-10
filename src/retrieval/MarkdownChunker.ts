import { estimateTokens } from "../context/tokenEstimate";

export interface MarkdownChunk {
  id: string;
  path: string;
  basename: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  tokenEstimate: number;
  contentHash: string;
}

export interface MarkdownChunkerOptions {
  maxTokensPerChunk?: number;
}

const DEFAULT_MAX_TOKENS_PER_CHUNK = 320;
const MIN_CONTENT_LENGTH = 8;

export class MarkdownChunker {
  constructor(private readonly options: MarkdownChunkerOptions = {}) {}

  chunk(path: string, basename: string, content: string): MarkdownChunk[] {
    const maxTokensPerChunk = this.options.maxTokensPerChunk ?? DEFAULT_MAX_TOKENS_PER_CHUNK;
    if (!Number.isInteger(maxTokensPerChunk) || maxTokensPerChunk <= 0) {
      throw new Error("maxTokensPerChunk must be a positive integer.");
    }

    const lines = content.split(/\r?\n/);
    const chunks: MarkdownChunk[] = [];
    let chunkLines: string[] = [];
    let chunkStartLine = 1;

    lines.forEach((line, index) => {
      if (estimateTokens(line) > maxTokensPerChunk) {
        pushChunk(chunks, path, basename, chunkLines, chunkStartLine, index);
        chunkLines = [];

        for (const segment of splitLine(line, maxTokensPerChunk)) {
          pushChunk(chunks, path, basename, [segment], index + 1, index + 1, true);
        }
        chunkStartLine = index + 2;
        return;
      }

      if (chunkLines.length === 0) {
        chunkStartLine = index + 1;
      }

      const nextLines = [...chunkLines, line];
      if (chunkLines.length > 0 && estimateTokens(nextLines.join("\n")) > maxTokensPerChunk) {
        pushChunk(chunks, path, basename, chunkLines, chunkStartLine, index);
        chunkLines = [line];
        chunkStartLine = index + 1;
        return;
      }

      chunkLines = nextLines;
    });

    pushChunk(chunks, path, basename, chunkLines, chunkStartLine, lines.length);

    return chunks;
  }
}

function pushChunk(
  chunks: MarkdownChunk[],
  path: string,
  basename: string,
  lines: string[],
  lineStart: number,
  lineEnd: number,
  allowShortContent = false,
): void {
  const content = lines.join("\n").trim();
  if (!content || (!allowShortContent && content.length < MIN_CONTENT_LENGTH)) {
    return;
  }

  const contentHash = hashContent(content);
  chunks.push({
    id: `semantic-search:${path}:${lineStart}-${lineEnd}:${contentHash.slice(0, 8)}`,
    path,
    basename,
    content,
    lineStart,
    lineEnd,
    tokenEstimate: estimateTokens(content),
    contentHash,
  });
}

function splitLine(line: string, maxTokensPerChunk: number): string[] {
  const maxCharacters = maxTokensPerChunk * 4;
  const segments: string[] = [];

  for (let index = 0; index < line.length; index += maxCharacters) {
    segments.push(line.slice(index, index + maxCharacters));
  }

  return segments;
}

export function hashContent(content: string): string {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
