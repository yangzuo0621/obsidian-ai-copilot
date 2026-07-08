import { createProvider } from "../providers/ProviderRegistry";
import type { ChatMessage } from "../providers/types";
import type { CopilotSettings } from "../settings/types";

import { createChatMessageRecord, createChatSession, updateSessionTitle } from "./ChatSession";
import type { ChatSession, ChatState } from "./types";

type ChatStateListener = (state: ChatState) => void;

export class ChatService {
  private readonly session: ChatSession = createChatSession();
  private readonly listeners = new Set<ChatStateListener>();
  private isSending = false;

  constructor(private readonly getSettings: () => CopilotSettings) {}

  getState(): ChatState {
    return {
      session: {
        ...this.session,
        messages: [...this.session.messages],
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
    const assistantMessage = createChatMessageRecord("assistant", "Thinking...", "pending");

    this.session.messages.push(userMessage, assistantMessage);
    updateSessionTitle(this.session);
    this.session.updatedAt = Date.now();
    this.isSending = true;
    this.notify();

    try {
      const settings = this.getSettings();
      const provider = createProvider(settings);
      const result = await provider.complete({
        model: settings.model,
        temperature: settings.temperature,
        messages: this.buildProviderMessages(assistantMessage.id),
      });

      assistantMessage.content = result.content;
      assistantMessage.status = "done";
      assistantMessage.error = undefined;
    } catch (error) {
      assistantMessage.content = "The provider request failed.";
      assistantMessage.status = "error";
      assistantMessage.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.isSending = false;
      this.session.updatedAt = Date.now();
      this.notify();
    }
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
