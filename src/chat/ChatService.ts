import type { ContextBlock } from "../context/types";
import { summarizeContextBlock } from "../context/types";
import { createProvider } from "../providers/ProviderRegistry";
import type { ChatMessage } from "../providers/types";
import { PromptComposer } from "../prompts/PromptComposer";
import type { CopilotSettings } from "../settings/types";
import { StreamController } from "../streaming/StreamController";

import { createChatMessageRecord, updateSessionTitle } from "./ChatSession";
import { ChatStore } from "./ChatStore";
import type { ChatSession, ChatState, PersistedChatData } from "./types";

type ChatStateListener = (state: ChatState) => void;
type SaveChatData = (data: PersistedChatData) => Promise<void>;

interface ContextBuilderLike {
  build(options: {
    includeCurrentFile: boolean;
    includeSelection: boolean;
    includeVaultSearch: boolean;
    includeEmbeddingRetrieval: boolean;
    tokenBudget: number;
    userInput: string;
  }): Promise<ContextBlock[]>;
}

export class ChatService {
  private readonly listeners = new Set<ChatStateListener>();
  private readonly streamController = new StreamController();
  private readonly promptComposer = new PromptComposer();
  private activeRequestId: string | null = null;
  private isSending = false;

  constructor(
    private readonly getSettings: () => CopilotSettings,
    private readonly contextBuilder?: ContextBuilderLike,
    private readonly chatStore = new ChatStore(),
    private readonly saveChatData?: SaveChatData,
  ) {}

  getState(): ChatState {
    const session = this.chatStore.getActiveSession();

    return {
      session: {
        ...session,
        messages: session.messages.map((message) => ({ ...message })),
      },
      sessions: this.chatStore.getSessions(),
      activeSessionId: this.chatStore.getActiveSessionId(),
      isSending: this.isSending,
      contextBlocks: this.getLatestContextBlocks(session),
    };
  }

  getPersistedChatData(): PersistedChatData {
    return this.chatStore.toJSON();
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

    const session = this.chatStore.getActiveSession();
    const sessionId = session.id;
    const userMessage = createChatMessageRecord("user", content);
    const assistantMessage = createChatMessageRecord("assistant", "", "pending");

    this.chatStore.appendMessages(sessionId, [userMessage, assistantMessage]);
    updateSessionTitle(session);
    this.isSending = true;
    this.activeRequestId = assistantMessage.id;
    this.notify();

    try {
      const settings = this.getSettings();
      const contextBlocks = await this.buildContextBlocks(settings, content);
      userMessage.contextBlocks = contextBlocks.map(summarizeContextBlock);
      const provider = createProvider(settings);
      assistantMessage.status = "streaming";
      this.notify();

      await this.streamController.start({
        id: assistantMessage.id,
        provider,
        request: {
          model: settings.model,
          temperature: settings.temperature,
          messages: this.buildProviderMessages(session, userMessage.id, contextBlocks),
        },
        callbacks: {
          onToken: (token) => {
            if (this.activeRequestId !== assistantMessage.id) {
              return;
            }

            this.chatStore.updateMessage(sessionId, assistantMessage.id, (message) => {
              message.content += token;
              message.status = "streaming";
              message.error = undefined;
            });
            this.notify();
          },
          onDone: () => {
            if (this.activeRequestId !== assistantMessage.id) {
              return;
            }

            this.chatStore.updateMessage(sessionId, assistantMessage.id, (message) => {
              message.status = "done";
              message.error = undefined;
            });
            this.notify();
          },
          onAbort: () => {
            if (this.activeRequestId !== assistantMessage.id) {
              return;
            }

            this.chatStore.updateMessage(sessionId, assistantMessage.id, (message) => {
              message.status = "aborted";
              message.content = message.content || "Generation stopped.";
              message.error = undefined;
            });
            this.notify();
          },
          onError: (error) => {
            if (this.activeRequestId !== assistantMessage.id) {
              return;
            }

            this.chatStore.updateMessage(sessionId, assistantMessage.id, (message) => {
              message.content = message.content || "The provider request failed.";
              message.status = "error";
              message.error = error instanceof Error ? error.message : String(error);
            });
            this.notify();
          },
        },
      });
    } catch (error) {
      this.chatStore.updateMessage(sessionId, assistantMessage.id, (message) => {
        message.content = "The provider request failed.";
        message.status = "error";
        message.error = error instanceof Error ? error.message : String(error);
      });
    } finally {
      this.isSending = false;
      this.activeRequestId = null;
      this.chatStore.touchSession(sessionId);
      await this.persistChatData();
      this.notify();
    }
  }

  stopGeneration(): void {
    if (!this.activeRequestId) {
      return;
    }

    this.streamController.abort(this.activeRequestId);
  }

  async createSession(): Promise<void> {
    if (this.isSending) {
      return;
    }

    this.chatStore.createSession();
    await this.persistChatData();
    this.notify();
  }

  async switchSession(sessionId: string): Promise<void> {
    if (this.isSending || !this.chatStore.switchSession(sessionId)) {
      return;
    }

    await this.persistChatData();
    this.notify();
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (this.isSending || !this.chatStore.deleteSession(sessionId)) {
      return;
    }

    await this.persistChatData();
    this.notify();
  }

  private async buildContextBlocks(settings: CopilotSettings, userInput: string): Promise<ContextBlock[]> {
    if (!this.contextBuilder) {
      return [];
    }

    return this.contextBuilder.build({
      includeCurrentFile: settings.includeCurrentFile,
      includeSelection: settings.includeSelection,
      includeVaultSearch: settings.includeVaultSearch,
      includeEmbeddingRetrieval: settings.includeEmbeddingRetrieval,
      tokenBudget: settings.contextTokenBudget,
      userInput,
    });
  }

  private buildProviderMessages(
    session: ChatSession,
    currentUserMessageId: string,
    contextBlocks: ContextBlock[],
  ): ChatMessage[] {
    const currentUserMessage = session.messages.find((message) => message.id === currentUserMessageId);
    const history = session.messages
      .filter((message) => message.id !== currentUserMessageId)
      .filter((message) => message.status === "done")
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    return this.promptComposer.compose({
      userInput: currentUserMessage?.content ?? "",
      contextBlocks,
      history,
    });
  }

  private getLatestContextBlocks(session: ChatSession) {
    const message = [...session.messages].reverse().find((candidate) => candidate.contextBlocks);
    return message?.contextBlocks ?? [];
  }

  private async persistChatData(): Promise<void> {
    await this.saveChatData?.(this.chatStore.toJSON());
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
