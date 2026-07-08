import { createProvider } from "../providers/ProviderRegistry";
import type { ChatMessage } from "../providers/types";
import type { CopilotSettings } from "../settings/types";
import { StreamController } from "../streaming/StreamController";

import { createChatMessageRecord, createChatSession, updateSessionTitle } from "./ChatSession";
import type { ChatSession, ChatState } from "./types";

type ChatStateListener = (state: ChatState) => void;

export class ChatService {
  private readonly session: ChatSession = createChatSession();
  private readonly listeners = new Set<ChatStateListener>();
  private readonly streamController = new StreamController();
  private activeRequestId: string | null = null;
  private isSending = false;

  constructor(private readonly getSettings: () => CopilotSettings) {}

  getState(): ChatState {
    return {
      session: {
        ...this.session,
        messages: this.session.messages.map((message) => ({ ...message })),
      },
      isSending: this.isSending,
    };
  }

  subscribe(listener: ChatStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  async sendMessage(input: string): Promise<void> {
    const content = input.trim();
    if (!content || this.isSending) {
      return;
    }

    const userMessage = createChatMessageRecord("user", content);
    const assistantMessage = createChatMessageRecord("assistant", "", "pending");

    this.session.messages.push(userMessage, assistantMessage);
    updateSessionTitle(this.session);
    this.session.updatedAt = Date.now();
    this.isSending = true;
    this.activeRequestId = assistantMessage.id;
    this.notify();

    try {
      const settings = this.getSettings();
      const provider = createProvider(settings);
      assistantMessage.status = "streaming";
      this.notify();

      await this.streamController.start({
        id: assistantMessage.id,
        provider,
        request: {
          model: settings.model,
          temperature: settings.temperature,
          messages: this.buildProviderMessages(assistantMessage.id),
        },
        callbacks: {
          onToken: (token) => {
            if (this.activeRequestId !== assistantMessage.id) {
              return;
            }

            assistantMessage.content += token;
            assistantMessage.status = "streaming";
            assistantMessage.error = undefined;
            this.session.updatedAt = Date.now();
            this.notify();
          },
          onDone: () => {
            if (this.activeRequestId !== assistantMessage.id) {
              return;
            }

            assistantMessage.status = "done";
            assistantMessage.error = undefined;
            this.session.updatedAt = Date.now();
            this.notify();
          },
          onAbort: () => {
            if (this.activeRequestId !== assistantMessage.id) {
              return;
            }

            assistantMessage.status = "aborted";
            assistantMessage.content = assistantMessage.content || "Generation stopped.";
            assistantMessage.error = undefined;
            this.session.updatedAt = Date.now();
            this.notify();
          },
          onError: (error) => {
            if (this.activeRequestId !== assistantMessage.id) {
              return;
            }

            assistantMessage.content = assistantMessage.content || "The provider request failed.";
            assistantMessage.status = "error";
            assistantMessage.error = error instanceof Error ? error.message : String(error);
            this.session.updatedAt = Date.now();
            this.notify();
          },
        },
      });
    } catch (error) {
      assistantMessage.content = "The provider request failed.";
      assistantMessage.status = "error";
      assistantMessage.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.isSending = false;
      this.activeRequestId = null;
      this.session.updatedAt = Date.now();
      this.notify();
    }
  }

  stopGeneration(): void {
    if (!this.activeRequestId) {
      return;
    }

    this.streamController.abort(this.activeRequestId);
  }

  private buildProviderMessages(pendingAssistantMessageId: string): ChatMessage[] {
    return this.session.messages
      .filter((message) => message.id !== pendingAssistantMessageId)
      .filter((message) => message.status === "done")
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
