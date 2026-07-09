export interface CopilotSettings {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  contextTokenBudget: number;
  includeCurrentFile: boolean;
  includeSelection: boolean;
  includeVaultSearch: boolean;
}
