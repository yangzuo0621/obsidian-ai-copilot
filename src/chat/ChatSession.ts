import type { ChatMessageRecord, ChatSession, ChatMessageRole, ChatMessageStatus } from "./types";

export function createChatSession(): ChatSession {
  const now = Date.now();

  return {
    id: createId("session"),
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createChatMessageRecord(
  role: ChatMessageRole,
  content: string,
  status: ChatMessageStatus = "done",
): ChatMessageRecord {
  return {
    id: createId("message"),
    role,
    content,
    createdAt: Date.now(),
    status,
  };
}

export function updateSessionTitle(session: ChatSession): void {
  const firstUserMessage = session.messages.find((message) => message.role === "user");
  if (!firstUserMessage) {
    session.title = "New chat";
    return;
  }

  const normalized = firstUserMessage.content.replace(/\s+/g, " ").trim();
  session.title = normalized.length > 48 ? `${normalized.slice(0, 45)}...` : normalized;
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
