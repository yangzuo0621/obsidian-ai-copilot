import type { ChatMessage } from "../providers/types";

export type ChatMessageRole = ChatMessage["role"];

export type ChatMessageStatus = "pending" | "streaming" | "done" | "aborted" | "error";

export interface ChatMessageRecord {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: number;
  status: ChatMessageStatus;
  error?: string;
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
}
