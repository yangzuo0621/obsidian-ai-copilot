import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../settings/defaults";

import { ChatService } from "./ChatService";
import type { ChatState } from "./types";

const providerComplete = vi.hoisted(() => vi.fn());

vi.mock("../providers/ProviderRegistry", () => ({
  createProvider: () => ({
    id: "test-provider",
    label: "Test provider",
    complete: providerComplete,
  }),
}));

describe("ChatService", () => {
  beforeEach(() => {
    providerComplete.mockReset();
  });

  it("notifies subscribers with the initial state", () => {
    const service = new ChatService(() => DEFAULT_SETTINGS);
    const listener = vi.fn();

    service.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      isSending: false,
      session: {
        title: "New chat",
        messages: [],
      },
    });
  });

  it("sends trimmed user input and stores the assistant response", async () => {
    providerComplete.mockResolvedValue({
      content: "Assistant reply",
      raw: {},
    });
    const service = new ChatService(() => ({
      ...DEFAULT_SETTINGS,
      model: "test-model",
      temperature: 0.2,
    }));
    const states: ChatState[] = [];
    service.subscribe((state) => states.push(state));

    await service.sendMessage("  Hello model  ");

    expect(providerComplete).toHaveBeenCalledWith({
      model: "test-model",
      temperature: 0.2,
      messages: [{ role: "user", content: "Hello model" }],
    });
    expect(service.getState()).toMatchObject({
      isSending: false,
      session: {
        title: "Hello model",
        messages: [
          { role: "user", content: "Hello model", status: "done" },
          { role: "assistant", content: "Assistant reply", status: "done" },
        ],
      },
    });
    expect(states.some((state) => state.isSending)).toBe(true);
  });

  it("records provider failures on the assistant message", async () => {
    providerComplete.mockRejectedValue(new Error("Network down"));
    const service = new ChatService(() => DEFAULT_SETTINGS);

    await service.sendMessage("Hello");

    expect(service.getState().session.messages[1]).toMatchObject({
      role: "assistant",
      content: "The provider request failed.",
      status: "error",
      error: "Network down",
    });
  });

  it("ignores empty messages", async () => {
    const service = new ChatService(() => DEFAULT_SETTINGS);

    await service.sendMessage("   ");

    expect(providerComplete).not.toHaveBeenCalled();
    expect(service.getState().session.messages).toEqual([]);
  });

  it("ignores a second send while a request is in flight", async () => {
    let resolveRequest!: () => void;
    providerComplete.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = () => resolve({ content: "Done", raw: {} });
      }),
    );
    const service = new ChatService(() => DEFAULT_SETTINGS);

    const firstSend = service.sendMessage("First");
    await service.sendMessage("Second");
    resolveRequest();
    await firstSend;

    expect(providerComplete).toHaveBeenCalledTimes(1);
    expect(service.getState().session.messages[0]?.content).toBe("First");
  });
});
