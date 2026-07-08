import { afterEach, describe, expect, it, vi } from "vitest";

import { createChatMessageRecord, createChatSession, updateSessionTitle } from "./ChatSession";

describe("ChatSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a new empty chat session", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);

    const session = createChatSession();

    expect(session.id).toMatch(/^session-/);
    expect(session.title).toBe("New chat");
    expect(session.messages).toEqual([]);
    expect(session.createdAt).toBe(1000);
    expect(session.updatedAt).toBe(1000);
  });

  it("creates done chat message records by default", () => {
    vi.spyOn(Date, "now").mockReturnValue(2000);

    const message = createChatMessageRecord("user", "Hello");

    expect(message).toMatchObject({
      role: "user",
      content: "Hello",
      createdAt: 2000,
      status: "done",
    });
    expect(message.id).toMatch(/^message-/);
  });

  it("sets the title from the first user message and normalizes whitespace", () => {
    const session = createChatSession();
    session.messages.push(createChatMessageRecord("assistant", "Hello"));
    session.messages.push(createChatMessageRecord("user", "  First\n\nquestion   here  "));

    updateSessionTitle(session);

    expect(session.title).toBe("First question here");
  });

  it("truncates long titles", () => {
    const session = createChatSession();
    session.messages.push(createChatMessageRecord("user", "a".repeat(60)));

    updateSessionTitle(session);

    expect(session.title).toHaveLength(48);
    expect(session.title).toBe(`${"a".repeat(45)}...`);
  });
});
