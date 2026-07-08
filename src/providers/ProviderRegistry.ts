import type { CopilotSettings } from "../settings/types";

import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider";
import type { LLMProvider } from "./types";

export function createProvider(settings: CopilotSettings): LLMProvider {
  if (settings.providerId !== "openai-compatible") {
    throw new Error(`Unsupported provider: ${settings.providerId}`);
  }

  return new OpenAICompatibleProvider({
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
  });
}
