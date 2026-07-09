import { ItemView, Notice } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";

import type { ChatService } from "../chat/ChatService";
import type { ChatMessageRecord, ChatState } from "../chat/types";
import type { ContextBlockSummary } from "../context/types";

export const COPILOT_VIEW_TYPE = "obsidian-ai-copilot-view";

export class CopilotView extends ItemView {
  private rootEl!: HTMLElement;
  private titleEl!: HTMLElement;
  private sessionSelectEl!: HTMLSelectElement;
  private newSessionButtonEl!: HTMLButtonElement;
  private deleteSessionButtonEl!: HTMLButtonElement;
  private contextPreviewEl!: HTMLElement;
  private messageListEl!: HTMLElement;
  private textareaEl!: HTMLTextAreaElement;
  private sendButtonEl!: HTMLButtonElement;
  private stopButtonEl!: HTMLButtonElement;
  private unsubscribe: (() => void) | null = null;
  private currentState: ChatState | null = null;

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
    return "AI Copilot";
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
    contentEl.addClass("obsidian-ai-copilot-view");

    this.rootEl = contentEl.createDiv({ cls: "obsidian-ai-copilot-root" });

    const headerEl = this.rootEl.createDiv({ cls: "obsidian-ai-copilot-header" });
    headerEl.createDiv({ cls: "obsidian-ai-copilot-heading", text: "AI Copilot" });
    this.titleEl = headerEl.createDiv({ cls: "obsidian-ai-copilot-session-title" });
    const sessionControlsEl = headerEl.createDiv({ cls: "obsidian-ai-copilot-session-controls" });
    this.sessionSelectEl = sessionControlsEl.createEl("select", {
      cls: "obsidian-ai-copilot-session-select",
      attr: {
        "aria-label": "Chat session",
      },
    });
    this.newSessionButtonEl = sessionControlsEl.createEl("button", {
      cls: "obsidian-ai-copilot-session-new",
      text: "New",
    });
    this.deleteSessionButtonEl = sessionControlsEl.createEl("button", {
      cls: "obsidian-ai-copilot-session-delete",
      text: "Delete",
    });
    this.contextPreviewEl = this.rootEl.createDiv({ cls: "obsidian-ai-copilot-context-preview" });

    this.messageListEl = this.rootEl.createDiv({ cls: "obsidian-ai-copilot-messages" });

    const composerEl = this.rootEl.createDiv({ cls: "obsidian-ai-copilot-composer" });
    this.textareaEl = composerEl.createEl("textarea", {
      cls: "obsidian-ai-copilot-input",
      attr: {
        placeholder: "Ask a question...",
        rows: "3",
      },
    });
    this.sendButtonEl = composerEl.createEl("button", {
      cls: "mod-cta obsidian-ai-copilot-send",
      text: "Send",
    });
    this.stopButtonEl = composerEl.createEl("button", {
      cls: "obsidian-ai-copilot-stop",
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

      const shouldDelete = confirm(`Delete "${state.session.title}"? This only removes the saved chat history.`);
      if (shouldDelete) {
        void this.chatService.deleteSession(state.activeSessionId);
      }
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
        cls: "obsidian-ai-copilot-empty",
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
  }

  private renderContextPreview(contextBlocks: ContextBlockSummary[]): void {
    this.contextPreviewEl.empty();

    if (contextBlocks.length === 0) {
      this.contextPreviewEl.createDiv({
        cls: "obsidian-ai-copilot-context-empty",
        text: "No note context attached.",
      });
      return;
    }

    this.contextPreviewEl.createDiv({
      cls: "obsidian-ai-copilot-context-label",
      text: "Context used",
    });

    const listEl = this.contextPreviewEl.createDiv({ cls: "obsidian-ai-copilot-context-list" });
    for (const block of contextBlocks) {
      this.renderContextBlock(listEl, block);
    }
  }

  private renderContextBlock(parentEl: HTMLElement, block: ContextBlockSummary): void {
    const blockEl = parentEl.createDiv({ cls: "obsidian-ai-copilot-context-block" });
    blockEl.createSpan({
      cls: "obsidian-ai-copilot-context-type",
      text: block.type === "selection" ? "Selection" : "Current file",
    });
    blockEl.createSpan({
      cls: "obsidian-ai-copilot-context-title",
      text: block.sourcePath ?? block.title,
    });
    const lineLabel = this.formatContextLineLabel(block);
    if (lineLabel) {
      blockEl.createSpan({
        cls: "obsidian-ai-copilot-context-lines",
        text: lineLabel,
      });
    }
    blockEl.createSpan({
      cls: "obsidian-ai-copilot-context-tokens",
      text: `~${block.tokenEstimate} tokens`,
    });
  }

  private formatContextLineLabel(block: ContextBlockSummary): string | null {
    if (!block.lineStart || !block.lineEnd) {
      return null;
    }

    return block.lineStart === block.lineEnd ? `Line ${block.lineStart}` : `Lines ${block.lineStart}-${block.lineEnd}`;
  }

  private renderMessage(message: ChatMessageRecord): void {
    const messageEl = this.messageListEl.createDiv({
      cls: `obsidian-ai-copilot-message obsidian-ai-copilot-message-${message.role}`,
    });

    const metaEl = messageEl.createDiv({ cls: "obsidian-ai-copilot-message-meta" });
    metaEl.createSpan({ text: message.role === "user" ? "You" : "Assistant" });

    if (message.status === "pending") {
      metaEl.createSpan({ cls: "obsidian-ai-copilot-status", text: "Pending" });
    } else if (message.status === "streaming") {
      metaEl.createSpan({ cls: "obsidian-ai-copilot-status", text: "Streaming" });
    } else if (message.status === "aborted") {
      metaEl.createSpan({ cls: "obsidian-ai-copilot-status", text: "Stopped" });
    } else if (message.status === "error") {
      metaEl.createSpan({ cls: "obsidian-ai-copilot-status obsidian-ai-copilot-status-error", text: "Error" });
    }

    messageEl.createDiv({
      cls: "obsidian-ai-copilot-message-content",
      text: message.content || (message.status === "streaming" ? "..." : ""),
    });

    if (message.error) {
      messageEl.createDiv({
        cls: "obsidian-ai-copilot-message-error",
        text: message.error,
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
      new Notice(`Copilot request failed: ${latestMessage.error}`);
    }
  }

  private updateComposerState(): void {
    const isSending = this.currentState?.isSending ?? false;
    const hasInput = this.textareaEl.value.trim().length > 0;

    this.textareaEl.disabled = isSending;
    this.sessionSelectEl.disabled = isSending;
    this.newSessionButtonEl.disabled = isSending;
    this.deleteSessionButtonEl.disabled = isSending;
    this.sendButtonEl.disabled = isSending || !hasInput;
    this.sendButtonEl.setText(isSending ? "Sending..." : "Send");
    this.stopButtonEl.disabled = !isSending;
    this.stopButtonEl.toggleClass("is-hidden", !isSending);
  }
}
