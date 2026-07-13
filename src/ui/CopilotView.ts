import { ItemView, Modal, Notice } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";

import type { ChatService } from "../chat/ChatService";
import type { ChatMessageRecord, ChatMode, ChatState, ToolActivityRecord } from "../chat/types";
import type { ContextBlockSummary } from "../context/types";

export const COPILOT_VIEW_TYPE = "vault-loom-view";

export class CopilotView extends ItemView {
  private rootEl!: HTMLElement;
  private titleEl!: HTMLElement;
  private sessionSelectEl!: HTMLSelectElement;
  private newSessionButtonEl!: HTMLButtonElement;
  private deleteSessionButtonEl!: HTMLButtonElement;
  private modeSelectEl!: HTMLSelectElement;
  private contextPreviewEl!: HTMLElement;
  private messageListEl!: HTMLElement;
  private textareaEl!: HTMLTextAreaElement;
  private sendButtonEl!: HTMLButtonElement;
  private stopButtonEl!: HTMLButtonElement;
  private unsubscribe: (() => void) | null = null;
  private currentState: ChatState | null = null;
  private isContextPreviewExpanded = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly chatService: ChatService,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return COPILOT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Vault Loom";
  }

  getIcon(): string {
    return "bot";
  }

  override onload(): void {
    this.initializeView();
  }

  override async onOpen(): Promise<void> {
    this.initializeView();
  }

  override async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private initializeView(): void {
    if (this.unsubscribe) {
      return;
    }

    this.buildLayout();
    this.unsubscribe = this.chatService.subscribe((state) => {
      this.currentState = state;
      this.render(state);
    });
  }

  private buildLayout(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("vault-loom-view");

    this.rootEl = contentEl.createDiv({ cls: "vault-loom-root" });

    const headerEl = this.rootEl.createDiv({ cls: "vault-loom-header" });
    headerEl.createDiv({ cls: "vault-loom-heading", text: "Vault Loom" });
    this.titleEl = headerEl.createDiv({ cls: "vault-loom-session-title" });
    const sessionControlsEl = headerEl.createDiv({ cls: "vault-loom-session-controls" });
    this.sessionSelectEl = sessionControlsEl.createEl("select", {
      cls: "vault-loom-session-select",
      attr: {
        "aria-label": "Chat session",
      },
    });
    this.newSessionButtonEl = sessionControlsEl.createEl("button", {
      cls: "vault-loom-session-new",
      text: "New",
    });
    this.deleteSessionButtonEl = sessionControlsEl.createEl("button", {
      cls: "vault-loom-session-delete",
      text: "Delete",
    });
    this.modeSelectEl = sessionControlsEl.createEl("select", {
      cls: "vault-loom-mode-select",
      attr: { "aria-label": "Vault Loom mode" },
    });
    this.modeSelectEl.createEl("option", { text: "Chat", value: "chat" });
    this.modeSelectEl.createEl("option", { text: "Agent", value: "agent" });
    this.contextPreviewEl = this.rootEl.createDiv({ cls: "vault-loom-context-preview" });

    this.messageListEl = this.rootEl.createDiv({ cls: "vault-loom-messages" });

    const composerEl = this.rootEl.createDiv({ cls: "vault-loom-composer" });
    this.textareaEl = composerEl.createEl("textarea", {
      cls: "vault-loom-input",
      attr: {
        placeholder: "Ask a question...",
        rows: "3",
      },
    });
    this.sendButtonEl = composerEl.createEl("button", {
      cls: "mod-cta vault-loom-send",
      text: "Send",
    });
    this.stopButtonEl = composerEl.createEl("button", {
      cls: "vault-loom-stop",
      text: "Stop",
    });

    this.registerDomEvent(this.sendButtonEl, "click", () => {
      void this.submitMessage();
    });

    this.registerDomEvent(this.stopButtonEl, "click", () => {
      this.chatService.stopGeneration();
    });

    this.registerDomEvent(this.sessionSelectEl, "change", () => {
      void this.chatService.switchSession(this.sessionSelectEl.value);
    });

    this.registerDomEvent(this.newSessionButtonEl, "click", () => {
      void this.chatService.createSession();
    });

    this.registerDomEvent(this.deleteSessionButtonEl, "click", () => {
      const state = this.currentState;
      if (!state) {
        return;
      }

      void this.confirmAndDeleteActiveSession(state);
    });

    this.registerDomEvent(this.modeSelectEl, "change", () => {
      this.chatService.setMode(this.modeSelectEl.value as ChatMode);
    });

    this.registerDomEvent(this.textareaEl, "keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void this.submitMessage();
      }
    });

    this.registerDomEvent(this.textareaEl, "input", () => {
      this.updateComposerState();
    });
  }

  private render(state: ChatState): void {
    this.titleEl.setText(state.session.title);
    this.renderSessionControls(state);
    this.renderContextPreview(state.contextBlocks);
    this.messageListEl.empty();

    if (state.session.messages.length === 0) {
      this.messageListEl.createDiv({
        cls: "vault-loom-empty",
        text: "Start a chat from here. Responses stream in as they are generated.",
      });
    } else {
      for (const message of state.session.messages) {
        this.renderMessage(message);
      }
    }

    this.updateComposerState();
    this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
  }

  private renderSessionControls(state: ChatState): void {
    this.sessionSelectEl.empty();

    for (const session of state.sessions) {
      const optionEl = this.sessionSelectEl.createEl("option", {
        text: `${session.title} (${Math.floor(session.messageCount / 2)})`,
        value: session.id,
      });
      optionEl.selected = session.id === state.activeSessionId;
    }

    this.sessionSelectEl.disabled = state.isSending;
    this.newSessionButtonEl.disabled = state.isSending;
    this.deleteSessionButtonEl.disabled = state.isSending;
    this.modeSelectEl.value = state.mode;
    this.modeSelectEl.disabled = state.isSending;
  }

  private renderContextPreview(contextBlocks: ContextBlockSummary[]): void {
    this.contextPreviewEl.empty();

    if (contextBlocks.length === 0) {
      this.contextPreviewEl.createDiv({
        cls: "vault-loom-context-empty",
        text: "No note context attached.",
      });
      return;
    }

    const detailsEl = this.contextPreviewEl.createEl("details", {
      cls: "vault-loom-context-details",
    });
    detailsEl.open = this.isContextPreviewExpanded;

    const summaryEl = detailsEl.createEl("summary", {
      cls: "vault-loom-context-summary",
      text: `Context used (${contextBlocks.length})`,
    });
    summaryEl.createSpan({
      cls: "vault-loom-context-summary-hint",
      text: this.isContextPreviewExpanded ? "Hide" : "Show",
    });

    detailsEl.addEventListener("toggle", () => {
      this.isContextPreviewExpanded = detailsEl.open;
    });

    const listEl = detailsEl.createDiv({ cls: "vault-loom-context-list" });
    for (const block of contextBlocks) {
      this.renderContextBlock(listEl, block);
    }
  }

  private renderContextBlock(parentEl: HTMLElement, block: ContextBlockSummary): void {
    const blockEl = parentEl.createDiv({ cls: "vault-loom-context-block" });
    blockEl.createSpan({
      cls: "vault-loom-context-type",
      text: this.formatContextType(block),
    });
    blockEl.createSpan({
      cls: "vault-loom-context-title",
      text: block.sourcePath ?? block.title,
    });
    const lineLabel = this.formatContextLineLabel(block);
    if (lineLabel) {
      blockEl.createSpan({
        cls: "vault-loom-context-lines",
        text: lineLabel,
      });
    }
    blockEl.createSpan({
      cls: "vault-loom-context-tokens",
      text: `~${block.tokenEstimate} tokens`,
    });
  }

  private formatContextLineLabel(block: ContextBlockSummary): string | null {
    if (!block.lineStart || !block.lineEnd) {
      return null;
    }

    return block.lineStart === block.lineEnd ? `Line ${block.lineStart}` : `Lines ${block.lineStart}-${block.lineEnd}`;
  }

  private formatContextType(block: ContextBlockSummary): string {
    if (block.type === "selection") {
      return "Selection";
    }

    if (block.type === "current-file") {
      return "Current file";
    }

    if (block.type === "vault-search") {
      return "Vault search";
    }

    if (block.type === "semantic-search") {
      return "Semantic search";
    }

    return "Context";
  }

  private renderMessage(message: ChatMessageRecord): void {
    const messageEl = this.messageListEl.createDiv({
      cls: `vault-loom-message vault-loom-message-${message.role}`,
    });

    const metaEl = messageEl.createDiv({ cls: "vault-loom-message-meta" });
    metaEl.createSpan({ text: message.role === "user" ? "You" : "Assistant" });

    if (message.status === "pending") {
      metaEl.createSpan({ cls: "vault-loom-status", text: "Pending" });
    } else if (message.status === "streaming") {
      metaEl.createSpan({ cls: "vault-loom-status", text: "Streaming" });
    } else if (message.status === "aborted") {
      metaEl.createSpan({ cls: "vault-loom-status", text: "Stopped" });
    } else if (message.status === "error") {
      metaEl.createSpan({ cls: "vault-loom-status vault-loom-status-error", text: "Error" });
    }

    messageEl.createDiv({
      cls: "vault-loom-message-content",
      text: message.content || (message.status === "streaming" ? "..." : ""),
    });

    if (message.error) {
      messageEl.createDiv({
        cls: "vault-loom-message-error",
        text: message.error,
      });
    }

    if (message.toolActivities?.length) {
      const toolsEl = messageEl.createDiv({ cls: "vault-loom-tool-list" });
      for (const activity of message.toolActivities) {
        this.renderToolActivity(toolsEl, activity);
      }
    }
  }

  private renderToolActivity(parentEl: HTMLElement, activity: ToolActivityRecord): void {
    const activityEl = parentEl.createEl("details", { cls: "vault-loom-tool-activity" });
    const summaryEl = activityEl.createEl("summary");
    summaryEl.createSpan({ cls: "vault-loom-tool-name", text: activity.toolName });
    summaryEl.createSpan({
      cls: `vault-loom-tool-status vault-loom-tool-status-${activity.status}`,
      text: formatToolStatus(activity.status),
    });
    activityEl.createEl("pre", {
      cls: "vault-loom-tool-data",
      text: `Input\n${formatJson(activity.arguments)}`,
    });
    if (activity.result) {
      activityEl.createEl("pre", {
        cls: "vault-loom-tool-data",
        text: `Result\n${formatJson(activity.result)}`,
      });
    }
  }

  private async submitMessage(): Promise<void> {
    const value = this.textareaEl.value;
    if (!value.trim() || this.currentState?.isSending) {
      return;
    }

    this.textareaEl.value = "";
    this.updateComposerState();

    await this.chatService.sendMessage(value);

    const latestState = this.currentState;
    const latestMessage = latestState?.session.messages.at(-1);
    if (latestMessage?.status === "error" && latestMessage.error) {
      new Notice(`Vault Loom request failed: ${latestMessage.error}`);
    }
  }

  private async confirmAndDeleteActiveSession(state: ChatState): Promise<void> {
    const shouldDelete = await confirmDeleteSession(this.app, state.session.title);
    if (shouldDelete) {
      await this.deleteActiveSession(state.activeSessionId);
    }
  }

  private async deleteActiveSession(sessionId: string): Promise<void> {
    try {
      await this.chatService.deleteSession(sessionId);
    } finally {
      this.updateComposerState();
      this.focusComposer();
    }
  }

  private updateComposerState(): void {
    const isSending = this.currentState?.isSending ?? false;
    const hasInput = this.textareaEl.value.trim().length > 0;

    this.textareaEl.disabled = isSending;
    this.sessionSelectEl.disabled = isSending;
    this.newSessionButtonEl.disabled = isSending;
    this.deleteSessionButtonEl.disabled = isSending;
    this.modeSelectEl.disabled = isSending;
    this.sendButtonEl.disabled = isSending || !hasInput;
    this.sendButtonEl.setText(isSending ? "Sending..." : "Send");
    this.stopButtonEl.disabled = !isSending;
    this.stopButtonEl.toggleClass("is-hidden", !isSending);
  }

  private focusComposer(): void {
    const focus = () => {
      if (!this.textareaEl.disabled) {
        this.app.workspace.setActiveLeaf(this.leaf, { focus: true });
        this.textareaEl.click();
        this.textareaEl.focus({ preventScroll: true });
        const cursorPosition = this.textareaEl.value.length;
        this.textareaEl.setSelectionRange(cursorPosition, cursorPosition);
      }
    };

    for (const delay of [0, 50, 150, 300]) {
      setTimeout(focus, delay);
    }
  }
}

function formatToolStatus(status: ToolActivityRecord["status"]): string {
  if (status === "awaiting-confirmation") {
    return "Awaiting approval";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value) as unknown, null, 2);
  } catch {
    return value;
  }
}

function confirmDeleteSession(app: App, title: string): Promise<boolean> {
  return new Promise((resolve) => {
    new DeleteSessionConfirmationModal(app, title, resolve).open();
  });
}

class DeleteSessionConfirmationModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private readonly sessionTitle: string,
    private readonly resolve: (confirmed: boolean) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText("Delete chat session");
    this.contentEl.createEl("p", {
      text: `Delete "${this.sessionTitle}"? This only removes the saved chat history.`,
    });

    const actionsEl = this.contentEl.createDiv({ cls: "vault-loom-confirm-actions" });
    const cancelButtonEl = actionsEl.createEl("button", { text: "Cancel" });
    const deleteButtonEl = actionsEl.createEl("button", {
      cls: "mod-warning",
      text: "Delete",
    });

    cancelButtonEl.addEventListener("click", () => this.finish(false));
    deleteButtonEl.addEventListener("click", () => this.finish(true));
    deleteButtonEl.focus();
  }

  override onClose(): void {
    this.contentEl.empty();
    if (!this.resolved) {
      this.resolved = true;
      this.resolve(false);
    }
  }

  private finish(confirmed: boolean): void {
    if (this.resolved) {
      return;
    }

    this.resolved = true;
    this.resolve(confirmed);
    this.close();
  }
}
