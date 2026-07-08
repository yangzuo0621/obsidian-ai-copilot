import { ItemView, Notice } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";

import type { ChatService } from "../chat/ChatService";
import type { ChatMessageRecord, ChatState } from "../chat/types";

export const COPILOT_VIEW_TYPE = "obsidian-ai-copilot-view";

export class CopilotView extends ItemView {
  private rootEl!: HTMLElement;
  private titleEl!: HTMLElement;
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
    this.sendButtonEl.disabled = isSending || !hasInput;
    this.sendButtonEl.setText(isSending ? "Sending..." : "Send");
    this.stopButtonEl.disabled = !isSending;
    this.stopButtonEl.toggleClass("is-hidden", !isSending);
  }
}
