import type { CopilotSettings } from "./types";

export const DEFAULT_SETTINGS: CopilotSettings = {
  providerId: "openai-compatible",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  temperature: 0.7,
  contextTokenBudget: 4000,
  embeddingModel: "text-embedding-3-small",
  includeCurrentFile: true,
  includeSelection: true,
  includeVaultSearch: true,
  includeEmbeddingRetrieval: false,
};

export function normalizeSettings(data: Partial<CopilotSettings> | null | undefined): CopilotSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...data,
  };
}
