import type { VaultSearchResult } from "../retrieval/SearchService";
import type { Tool } from "./types";

export interface NoteToolAdapter {
  readNote(path: string): Promise<{ path: string; content: string }>;
  createNote(path: string, content: string): Promise<{ path: string }>;
  appendToNote(path: string, content: string): Promise<{ path: string }>;
}

export interface SelectionToolAdapter {
  getSelection(): string | null;
  getActiveFilePath(): string | null;
  replaceSelection(text: string): void;
}

export interface SearchToolService {
  search(query: string, options?: { maxResults?: number }): Promise<VaultSearchResult[]>;
}

export function createBuiltinTools(
  notes: NoteToolAdapter,
  search: SearchToolService,
  selection: SelectionToolAdapter,
): Tool[] {
  return [
    createSearchVaultTool(search),
    createReadNoteTool(notes),
    createCreateNoteTool(notes),
    createAppendNoteTool(notes),
    createReplaceSelectionTool(selection),
  ];
}

function createSearchVaultTool(search: SearchToolService): Tool {
  return {
    name: "search_vault",
    description: "Search Markdown note names and contents in the current Obsidian vault.",
    kind: "read",
    inputSchema: objectSchema(
      {
        query: { type: "string", description: "Keywords to search for." },
        max_results: { type: "integer", minimum: 1, maximum: 10, description: "Maximum number of results." },
      },
      ["query"],
    ),
    validate(input) {
      const record = requireObject(input);
      const query = requireString(record, "query");
      const maxResults = optionalInteger(record, "max_results", 1, 10) ?? 5;
      return { query, maxResults };
    },
    async run(input) {
      const results = await search.search(input.query as string, { maxResults: input.maxResults as number });
      return { content: JSON.stringify({ ok: true, results }) };
    },
  };
}

function createReadNoteTool(notes: NoteToolAdapter): Tool {
  return {
    name: "read_note",
    description: "Read one Markdown note from the current Obsidian vault by path.",
    kind: "read",
    inputSchema: pathSchema(),
    validate: validatePathInput,
    async run(input) {
      const note = await notes.readNote(input.path as string);
      return { content: JSON.stringify({ ok: true, ...note }) };
    },
  };
}

function createCreateNoteTool(notes: NoteToolAdapter): Tool {
  return {
    name: "create_note",
    description: "Create a new Markdown note in the current Obsidian vault. Existing notes are never overwritten.",
    kind: "write",
    inputSchema: contentSchema("Initial Markdown content for the new note."),
    validate: validateContentInput,
    getConfirmation(input) {
      return {
        toolName: "create_note",
        title: "Create note",
        description: `Create ${input.path as string}`,
        preview: input.content as string,
      };
    },
    async run(input) {
      const note = await notes.createNote(input.path as string, input.content as string);
      return { content: JSON.stringify({ ok: true, ...note, created: true }) };
    },
  };
}

function createAppendNoteTool(notes: NoteToolAdapter): Tool {
  return {
    name: "append_to_note",
    description: "Append Markdown content to an existing note in the current Obsidian vault.",
    kind: "write",
    inputSchema: contentSchema("Markdown content to append."),
    validate: validateContentInput,
    getConfirmation(input) {
      return {
        toolName: "append_to_note",
        title: "Append to note",
        description: `Append to ${input.path as string}`,
        preview: input.content as string,
      };
    },
    async run(input) {
      const note = await notes.appendToNote(input.path as string, input.content as string);
      return { content: JSON.stringify({ ok: true, ...note, appended: true }) };
    },
  };
}

function createReplaceSelectionTool(selection: SelectionToolAdapter): Tool {
  return {
    name: "replace_selection",
    description: "Replace the current non-empty editor selection with Markdown text.",
    kind: "write",
    inputSchema: objectSchema({ content: { type: "string", description: "Replacement Markdown content." } }, [
      "content",
    ]),
    validate(input) {
      const record = requireObject(input);
      const content = requireString(record, "content", true);
      const expectedSelection = selection.getSelection();
      if (!expectedSelection?.trim()) {
        throw new Error("No active editor selection is available.");
      }
      return { content, expectedSelection, expectedPath: selection.getActiveFilePath() };
    },
    getConfirmation(input) {
      const path = (input.expectedPath as string | null) ?? "the active note";
      return {
        toolName: "replace_selection",
        title: "Replace selection",
        description: `Replace the current selection in ${path}`,
        preview: `Current selection:\n${input.expectedSelection as string}\n\nReplacement:\n${input.content as string}`,
      };
    },
    async run(input) {
      if (
        selection.getSelection() !== input.expectedSelection ||
        selection.getActiveFilePath() !== input.expectedPath
      ) {
        throw new Error("The active note or selection changed before approval; nothing was replaced.");
      }
      selection.replaceSelection(input.content as string);
      return {
        content: JSON.stringify({ ok: true, path: selection.getActiveFilePath(), replacedSelection: true }),
      };
    },
  };
}

function pathSchema(): Record<string, unknown> {
  return objectSchema({ path: { type: "string", description: "Vault-relative Markdown note path." } }, ["path"]);
}

function contentSchema(description: string): Record<string, unknown> {
  return objectSchema(
    {
      path: { type: "string", description: "Vault-relative Markdown note path." },
      content: { type: "string", description },
    },
    ["path", "content"],
  );
}

function objectSchema(properties: Record<string, unknown>, required: string[]): Record<string, unknown> {
  return { type: "object", properties, required, additionalProperties: false };
}

function validatePathInput(input: unknown): Record<string, unknown> {
  const record = requireObject(input);
  return { path: requireString(record, "path") };
}

function validateContentInput(input: unknown): Record<string, unknown> {
  const record = requireObject(input);
  return {
    path: requireString(record, "path"),
    content: requireString(record, "content", true),
  };
}

function requireObject(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Tool input must be a JSON object.");
  }
  return input as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string, allowEmpty = false): string {
  const value = record[key];
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new Error(`Tool input "${key}" must be ${allowEmpty ? "a string" : "a non-empty string"}.`);
  }
  return value;
}

function optionalInteger(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`Tool input "${key}" must be an integer from ${minimum} to ${maximum}.`);
  }
  return value as number;
}
