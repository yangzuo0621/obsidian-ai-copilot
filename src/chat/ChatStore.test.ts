import { describe, expect, it, vi } from "vitest";

import { createChatMessageRecord } from "./ChatSession";
import { ChatStore, normalizeChatData } from "./ChatStore";

describe("ChatStore", () => {
  it("creates a default active session when no persisted data exists", () => {
    const store = new ChatStore();

    expect(store.getActiveSession()).toMatchObject({
      title: "New chat",
      messages: [],
    });
    expect(store.getSessions()).toHaveLength(1);
    expect(store.toJSON().activeSessionId).toBe(store.getActiveSession().id);
  });

  it("restores persisted sessions and active session", () => {
    const store = new ChatStore({
      activeSessionId: "session-two",
      sessions: [
        {
          id: "session-one",
          title: "First",
          messages: [],
          createdAt: 100,
          updatedAt: 200,
        },
        {
          id: "session-two",
          title: "Second",
          messages: [createChatMessageRecord("user", "Hello")],
          createdAt: 300,
          updatedAt: 400,
        },
      ],
    });

    expect(store.getActiveSession()).toMatchObject({
      id: "session-two",
      title: "Second",
    });
    expect(store.getSessions()).toEqual([
      {
        id: "session-one",
        title: "First",
        createdAt: 100,
        updatedAt: 200,
        messageCount: 0,
      },
      {
        id: "session-two",
        title: "Second",
        createdAt: 300,
        updatedAt: 400,
        messageCount: 1,
      },
    ]);
  });

  it("creates, switches, and deletes sessions", () => {
    const store = new ChatStore();
    const originalId = store.getActiveSessionId();
    const created = store.createSession();

    expect(store.getActiveSessionId()).toBe(created.id);
    expect(store.switchSession(originalId)).toBe(true);
    expect(store.getActiveSessionId()).toBe(originalId);
    expect(store.deleteSession(originalId)).toBe(true);
    expect(store.getActiveSessionId()).toBe(created.id);
    expect(store.getSessions()).toHaveLength(1);
  });

  it("keeps one replacement session after deleting the last session", () => {
    const store = new ChatStore();
    const onlySessionId = store.getActiveSessionId();

    expect(store.deleteSession(onlySessionId)).toBe(true);

    expect(store.getSessions()).toHaveLength(1);
    expect(store.getActiveSessionId()).not.toBe(onlySessionId);
  });

  it("normalizes missing or invalid persisted data", () => {
    vi.spyOn(Date, "now").mockReturnValue(5000);

    const data = normalizeChatData({
      activeSessionId: "missing",
      sessions: [
        {
          id: "session-valid",
          title: "",
          messages: [
            {
              id: "message-valid",
              role: "assistant",
              content: "Restored",
              createdAt: 100,
              status: "streaming",
            },
            {
              id: "message-invalid",
              role: "tool",
              content: "Ignore me",
              createdAt: 100,
              status: "done",
            },
          ],
          createdAt: 100,
          updatedAt: 200,
        },
      ],
    } as never);

    expect(data.activeSessionId).toBe("session-valid");
    expect(data.sessions[0]).toMatchObject({
      title: "New chat",
      messages: [
        {
          id: "message-valid",
          role: "assistant",
          content: "Restored",
          status: "aborted",
        },
      ],
    });

    vi.restoreAllMocks();
  });

  it("marks restored empty in-flight assistant messages as interrupted", () => {
    const data = normalizeChatData({
      activeSessionId: "session-valid",
      sessions: [
        {
          id: "session-valid",
          title: "Interrupted",
          messages: [
            {
              id: "message-pending",
              role: "assistant",
              content: "",
              createdAt: 100,
              status: "pending",
            },
          ],
          createdAt: 100,
          updatedAt: 200,
        },
      ],
    });

    expect(data.sessions[0]?.messages[0]).toMatchObject({
      id: "message-pending",
      role: "assistant",
      content: "Generation interrupted by plugin reload.",
      status: "aborted",
    });
  });
});
