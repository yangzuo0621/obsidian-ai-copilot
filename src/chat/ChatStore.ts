import { createChatSession } from "./ChatSession";
import type { ChatMessageRecord, ChatSession, ChatSessionSummary, PersistedChatData } from "./types";

export class ChatStore {
  private sessions: ChatSession[];
  private activeSessionId: string;

  constructor(data?: Partial<PersistedChatData> | null) {
    const normalized = normalizeChatData(data);
    this.sessions = normalized.sessions;
    this.activeSessionId = normalized.activeSessionId;
  }

  getActiveSession(): ChatSession {
    const session = this.sessions.find((candidate) => candidate.id === this.activeSessionId);
    if (session) {
      return session;
    }

    const fallback = this.sessions[0] ?? createChatSession();
    if (this.sessions.length === 0) {
      this.sessions.push(fallback);
    }
    this.activeSessionId = fallback.id;
    return fallback;
  }

  getSessions(): ChatSessionSummary[] {
    return this.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messages.length,
    }));
  }

  getActiveSessionId(): string {
    return this.getActiveSession().id;
  }

  createSession(): ChatSession {
    const session = createChatSession();
    this.sessions.unshift(session);
    this.activeSessionId = session.id;
    return session;
  }

  switchSession(sessionId: string): boolean {
    if (!this.sessions.some((session) => session.id === sessionId)) {
      return false;
    }

    this.activeSessionId = sessionId;
    return true;
  }

  deleteSession(sessionId: string): boolean {
    const index = this.sessions.findIndex((session) => session.id === sessionId);
    if (index < 0) {
      return false;
    }

    this.sessions.splice(index, 1);
    if (this.sessions.length === 0) {
      const replacement = createChatSession();
      this.sessions.push(replacement);
      this.activeSessionId = replacement.id;
      return true;
    }

    if (this.activeSessionId === sessionId) {
      const nextIndex = Math.min(index, this.sessions.length - 1);
      this.activeSessionId = this.sessions[nextIndex]?.id ?? this.sessions[0].id;
    }

    return true;
  }

  appendMessages(sessionId: string, messages: ChatMessageRecord[]): boolean {
    const session = this.findSession(sessionId);
    if (!session) {
      return false;
    }

    session.messages.push(...messages);
    session.updatedAt = Date.now();
    return true;
  }

  updateMessage(
    sessionId: string,
    messageId: string,
    update: (message: ChatMessageRecord, session: ChatSession) => void,
  ): boolean {
    const session = this.findSession(sessionId);
    const message = session?.messages.find((candidate) => candidate.id === messageId);
    if (!session || !message) {
      return false;
    }

    update(message, session);
    session.updatedAt = Date.now();
    return true;
  }

  touchSession(sessionId: string): boolean {
    const session = this.findSession(sessionId);
    if (!session) {
      return false;
    }

    session.updatedAt = Date.now();
    return true;
  }

  toJSON(): PersistedChatData {
    const activeSession = this.getActiveSession();

    return {
      activeSessionId: activeSession.id,
      sessions: this.sessions.map(cloneSession),
    };
  }

  private findSession(sessionId: string): ChatSession | undefined {
    return this.sessions.find((session) => session.id === sessionId);
  }
}

export function normalizeChatData(data?: Partial<PersistedChatData> | null): PersistedChatData {
  const sessions = Array.isArray(data?.sessions)
    ? data.sessions.map(normalizeSession).filter((session): session is ChatSession => session !== null)
    : [];

  if (sessions.length === 0) {
    const session = createChatSession();
    return {
      sessions: [session],
      activeSessionId: session.id,
    };
  }

  const activeSessionId =
    typeof data?.activeSessionId === "string" && sessions.some((session) => session.id === data.activeSessionId)
      ? data.activeSessionId
      : sessions[0].id;

  return {
    sessions,
    activeSessionId,
  };
}

function normalizeSession(value: unknown): ChatSession | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  const now = Date.now();
  const messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeMessage).filter((message): message is ChatMessageRecord => message !== null)
    : [];

  return {
    id: value.id,
    title: typeof value.title === "string" && value.title.trim() ? value.title : "New chat",
    messages,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : now,
  };
}

function normalizeMessage(value: unknown): ChatMessageRecord | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.content !== "string") {
    return null;
  }

  if (value.role !== "system" && value.role !== "user" && value.role !== "assistant") {
    return null;
  }

  const status =
    value.status === "pending" ||
    value.status === "streaming" ||
    value.status === "done" ||
    value.status === "aborted" ||
    value.status === "error"
      ? value.status
      : "done";

  return {
    id: value.id,
    role: value.role,
    content: value.content,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    status,
    error: typeof value.error === "string" ? value.error : undefined,
    contextBlocks: Array.isArray(value.contextBlocks) ? value.contextBlocks : undefined,
  };
}

function cloneSession(session: ChatSession): ChatSession {
  return {
    ...session,
    messages: session.messages.map((message) => ({ ...message })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
