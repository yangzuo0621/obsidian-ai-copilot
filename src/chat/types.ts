import type { ChatMessage } from "../providers/types";
import type { ContextBlockSummary } from "../context/types";

export type ChatMessageRole = Exclude<ChatMessage["role"], "tool">;

export type ChatMessageStatus = "pending" | "streaming" | "done" | "aborted" | "error";

export type ChatMode = "chat" | "agent";

export type ToolActivityStatus = "requested" | "awaiting-confirmation" | "running" | "succeeded" | "declined" | "error";

export interface ToolActivityRecord {
  id: string;
  toolCallId: string;
  toolName: string;
  arguments: string;
  status: ToolActivityStatus;
  result?: string;
  error?: string;
}

export interface ChatMessageRecord {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: number;
  status: ChatMessageStatus;
  error?: string;
  contextBlocks?: ContextBlockSummary[];
  toolActivities?: ToolActivityRecord[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessageRecord[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface PersistedChatData {
  sessions: ChatSession[];
  activeSessionId: string;
}

export interface ChatState {
  session: ChatSession;
  sessions: ChatSessionSummary[];
  activeSessionId: string;
  isSending: boolean;
  contextBlocks: ContextBlockSummary[];
  mode: ChatMode;
}
