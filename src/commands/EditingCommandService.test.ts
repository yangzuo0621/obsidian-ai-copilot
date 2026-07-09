import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContextBlock } from "../context/types";
import type { EditorAdapter } from "../obsidian/EditorAdapter";
import { DEFAULT_SETTINGS } from "../settings/defaults";

import { EditingCommandService } from "./EditingCommandService";

const providerComplete = vi.hoisted(() => vi.fn());

vi.mock("../providers/ProviderRegistry", () => ({
  createProvider: () => ({
    id: "test-provider",
    label: "Test provider",
    complete: providerComplete,
    stream: vi.fn(),
  }),
}));

const selectionBlock: ContextBlock = {
  id: "selection",
  type: "selection",
  title: "Selection in note.md",
  content: "Selected text",
  priority: 100,
  tokenEstimate: 3,
  sourcePath: "note.md",
};

const currentFileBlock: ContextBlock = {
  id: "current-file",
  type: "current-file",
  title: "note.md",
  content: "A long note",
  priority: 60,
  tokenEstimate: 3,
  sourcePath: "note.md",
};

describe("EditingCommandService", () => {
  beforeEach(() => {
    providerComplete.mockReset();
  });

  it("explains the current selection and inserts the result", async () => {
    providerComplete.mockResolvedValue({ content: "This explains it.", raw: {} });
    const editorAdapter = createEditorAdapter();
    const contextBuilder = {
      build: vi.fn().mockResolvedValue([selectionBlock]),
    };
    const service = new EditingCommandService(() => DEFAULT_SETTINGS, contextBuilder, editorAdapter);

    await service.explainSelection();

    expect(contextBuilder.build).toHaveBeenCalledWith({
      includeCurrentFile: false,
      includeSelection: true,
      includeVaultSearch: false,
      includeEmbeddingRetrieval: false,
      tokenBudget: DEFAULT_SETTINGS.contextTokenBudget,
      userInput: "Explain this selection.",
    });
    expect(providerComplete.mock.calls[0]?.[0].messages.at(-1)?.content).toContain("Explain the selected text");
    expect(editorAdapter.insertAtCursor).toHaveBeenCalledWith("\n\nAI explanation:\nThis explains it.\n", undefined);
  });

  it("rewrites the current selection and replaces it with provider content only", async () => {
    providerComplete.mockResolvedValue({ content: "Rewritten text", raw: {} });
    const editorAdapter = createEditorAdapter();
    const service = new EditingCommandService(
      () => DEFAULT_SETTINGS,
      { build: vi.fn().mockResolvedValue([selectionBlock]) },
      editorAdapter,
    );

    await service.rewriteSelection();

    expect(providerComplete.mock.calls[0]?.[0].messages.at(-1)?.content).toContain("Return only the rewritten text");
    expect(editorAdapter.replaceSelection).toHaveBeenCalledWith("Rewritten text", undefined);
    expect(editorAdapter.insertAtCursor).not.toHaveBeenCalled();
  });

  it("summarizes the current note and inserts the result", async () => {
    providerComplete.mockResolvedValue({ content: "Short summary.", raw: {} });
    const editorAdapter = createEditorAdapter();
    const contextBuilder = {
      build: vi.fn().mockResolvedValue([currentFileBlock]),
    };
    const service = new EditingCommandService(() => DEFAULT_SETTINGS, contextBuilder, editorAdapter);

    await service.summarizeCurrentNote();

    expect(contextBuilder.build).toHaveBeenCalledWith({
      includeCurrentFile: true,
      includeSelection: false,
      includeVaultSearch: false,
      includeEmbeddingRetrieval: false,
      tokenBudget: DEFAULT_SETTINGS.contextTokenBudget,
      userInput: "Summarize the current note.",
    });
    expect(editorAdapter.insertAtCursor).toHaveBeenCalledWith("\n\nAI summary:\nShort summary.\n", undefined);
  });

  it("requires a selection for selection commands", async () => {
    const editorAdapter = createEditorAdapter("");
    const service = new EditingCommandService(
      () => DEFAULT_SETTINGS,
      { build: vi.fn().mockResolvedValue([selectionBlock]) },
      editorAdapter,
    );

    await expect(service.rewriteSelection()).rejects.toThrow("Select text in the active editor first.");
    expect(providerComplete).not.toHaveBeenCalled();
  });
});

function createEditorAdapter(selection = "Selected text"): EditorAdapter {
  return {
    getSelection: vi.fn(() => selection),
    insertAtCursor: vi.fn(),
    replaceSelection: vi.fn(),
  } as unknown as EditorAdapter;
}
