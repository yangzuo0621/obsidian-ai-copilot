import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../settings/defaults";

import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider";
import { createProvider } from "./ProviderFactory";

vi.mock("obsidian", () => ({
  requestUrl: vi.fn(),
}));

describe("ProviderFactory", () => {
  it("creates the configured OpenAI-compatible provider", () => {
    const provider = createProvider(DEFAULT_SETTINGS);

    expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
    expect(provider.id).toBe("openai-compatible");
  });

  it("rejects unsupported provider ids", () => {
    expect(() =>
      createProvider({
        ...DEFAULT_SETTINGS,
        providerId: "unknown",
      }),
    ).toThrow("Unsupported provider: unknown");
  });
});
