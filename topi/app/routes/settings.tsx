import { useEffect, useState } from "react";
import type { Route } from "./+types/settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  generateMcpToken,
  getMcpTokenStatus,
  revokeMcpToken,
} from "@/lib/mcp-token";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "topi" },
    { name: "description", content: "应用设置" },
  ];
}

export default function Settings() {
  const [status, setStatus] = useState<{ hasToken: boolean; prefix?: string } | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMcpTokenStatus()
      .then((s) => setStatus(s))
      .catch(() => setStatus({ hasToken: false }))
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setActionLoading(true);
    try {
      const res = await generateMcpToken();
      setNewToken(res.token);
      setStatus({ hasToken: true, prefix: res.token.slice(0, 9) + "..." });
    } catch {
      // apiClient throws on 401, redirects to login
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    setActionLoading(true);
    try {
      await revokeMcpToken();
      setStatus({ hasToken: false });
      setNewToken(null);
    } finally {
      setActionLoading(false);
      setRevokeOpen(false);
    }
  };

  const handleCopy = () => {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">设置</h2>

      <Card>
        <CardHeader>
          <CardTitle>MCP 令牌</CardTitle>
          <CardDescription>
            用于 agent MCP 连接，长期有效。在 agent Settings → MCP 中配置 URL 时附带此令牌。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : (
            <>
              {newToken ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">请妥善保存，此令牌仅显示一次：</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-sm">{newToken}</code>
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                      {copied ? "已复制" : "复制"}
                    </Button>
                  </div>
                  <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
{`{
  "mcpServers": {
    "topi": {
      "url": "${apiBase}/mcp/sse?token=${newToken}"
    }
  }
}`}
                  </pre>
                  <Button variant="outline" onClick={() => setNewToken(null)}>
                    收起
                  </Button>
                </div>
              ) : status?.hasToken ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    当前令牌：<code className="rounded bg-muted px-1">{status.prefix ?? "—"}</code>
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleGenerate} disabled={actionLoading}>
                      {actionLoading ? "处理中..." : "重新生成"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setRevokeOpen(true)}
                      disabled={actionLoading}
                    >
                      撤销
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={handleGenerate} disabled={actionLoading}>
                  {actionLoading ? "生成中..." : "生成令牌"}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤销 MCP 令牌</AlertDialogTitle>
            <AlertDialogDescription>
              撤销后，当前 MCP 令牌将立即失效，需重新生成才能使用 agent MCP。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleRevoke}>
              撤销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
