import type { ChatMessage } from "../providers/types";
import type { ContextBlockSummary } from "../context/types";

export type ChatMessageRole = ChatMessage["role"];

export type ChatMessageStatus = "pending" | "streaming" | "done" | "aborted" | "error";

export interface ChatMessageRecord {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: number;
  status: ChatMessageStatus;
  error?: string;
  contextBlocks?: ContextBlockSummary[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessageRecord[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatState {
  session: ChatSession;
  isSending: boolean;
  contextBlocks: ContextBlockSummary[];
}
