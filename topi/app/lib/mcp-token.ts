import { apiClient } from "./api";

export type McpTokenStatus = {
  hasToken: boolean;
  prefix?: string;
};

export type McpTokenGenerateResult = {
  token: string;
  message: string;
};

export async function getMcpTokenStatus(): Promise<McpTokenStatus> {
  return apiClient.get<McpTokenStatus>("/mcp-token");
}

export async function generateMcpToken(): Promise<McpTokenGenerateResult> {
  return apiClient.post<McpTokenGenerateResult>("/mcp-token");
}

export async function revokeMcpToken(): Promise<void> {
  return apiClient.delete("/mcp-token");
}
