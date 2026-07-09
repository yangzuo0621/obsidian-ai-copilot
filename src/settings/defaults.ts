import type { CopilotSettings } from "./types";

export const DEFAULT_SETTINGS: CopilotSettings = {
  providerId: "openai-compatible",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  temperature: 0.7,
  contextTokenBudget: 4000,
  includeCurrentFile: true,
  includeSelection: true,
  includeVaultSearch: true,
};

export function normalizeSettings(data: Partial<CopilotSettings> | null | undefined): CopilotSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...data,
  };
}
