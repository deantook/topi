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
  const res = (await apiClient.get("/mcp-token")) as { data: McpTokenStatus };
  return res.data ?? { hasToken: false };
}

export async function generateMcpToken(): Promise<McpTokenGenerateResult> {
  const res = (await apiClient.post("/mcp-token")) as { data: McpTokenGenerateResult };
  if (!res.data?.token) throw new Error("Invalid response");
  return res.data;
}

export async function revokeMcpToken(): Promise<void> {
  await apiClient.delete("/mcp-token");
}
