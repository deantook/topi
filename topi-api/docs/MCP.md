# Topi MCP (Cursor 配置)

Topi 通过 MCP (Model Context Protocol) 暴露任务与列表管理工具，可在 Cursor 中配置使用。

## 传输方式

支持两种传输，Cursor 会优先尝试 Streamable HTTP，失败后回退到 SSE：

- **Streamable HTTP**（推荐）：POST 到 `/mcp/sse`，首次请求自动建立 session
- **SSE**：GET `/mcp/sse` 建立连接，再 POST 到 `/mcp/message`

**URL**: `http://localhost:8080/mcp/sse?token=YOUR_MCP_TOKEN`

## 获取 MCP 令牌

1. 启动 Topi 前端与 API
2. 在前端登录，进入 **设置** 页
3. 在「MCP 令牌」区块点击「生成令牌」
4. 复制显示的令牌（仅显示一次，请妥善保存）

## Cursor 配置示例

在 Cursor 的 MCP 配置（Cursor Settings → Features → MCP → Open Configuration File）中添加：

```json
{
  "mcpServers": {
    "topi": {
      "url": "http://localhost:8080/mcp/sse?token=YOUR_MCP_TOKEN"
    }
  }
}
```

将 `YOUR_MCP_TOKEN` 替换为在设置页生成的 MCP 令牌。保存后重启 Cursor，并在 Settings → Tools & MCP 中启用 topi 服务器（SSE 服务器默认需手动启用）。

### 可选：使用 Header 传递 Token

若希望通过 header 传递 token（避免出现在 URL 中）：

```json
{
  "mcpServers": {
    "topi": {
      "url": "http://localhost:8080/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_TOKEN"
      }
    }
  }
}
```

## 任务工具参数

| 工具 | 说明 | 参数 |
|------|------|------|
| `topi_create_task` | 创建任务 | `title`（必填）、`listId`、`dueDate`、`priority`、`detail`（Markdown，可选）、`estimatedHours`（整数小时，可选） |
| `topi_create_tasks` | 批量创建任务 | `tasks`：JSON 数组，每项 `{title, listId?, dueDate?, priority?, detail?, estimatedHours?}` |
| `topi_update_task` | 更新任务 | `id`（必填）、`title`、`listId`、`dueDate`、`priority`、`detail`、`estimatedHours` |
| `topi_list_tasks` | 列出任务 | 返回含 `detail`、`estimated_hours` 字段 |

## 远程部署说明

当 topi-api 部署在远程服务器（非 localhost）时，需在服务端设置环境变量 `MCP_BASE_URL`：

```
MCP_BASE_URL=http://117.50.220.90:8080
```

服务端会在 `endpoint` 事件中下发完整 message URL（含 host），确保 Cursor 客户端向正确地址 POST 请求。未设置时，仅下发路径，部分客户端可能错误解析为 localhost 导致任务创建失败。

## 认证说明

- MCP 使用专用 MCP 令牌认证，与登录 JWT 分离
- 在设置页生成 MCP 令牌，长期有效，除非主动撤销
- Token 可通过 query 参数 `token` 或 `Authorization: Bearer <token>` 传递

## 故障排查

若连接失败，按以下步骤检查：

1. **确认 topi-api 已启动**：访问 `http://localhost:8080/swagger/index.html` 应可打开。
2. **用 curl 测试 SSE**：`curl -N "http://localhost:8080/mcp/sse?token=YOUR_TOKEN"`，应返回 SSE 流而非 404。
3. **配置方式**：建议直接编辑 `~/.cursor/mcp.json` 或项目内 `.cursor/mcp.json`，而不是通过 Cursor 的「添加 MCP」 UI，避免 URL 被修改。
4. **重启 Cursor**：修改配置后需完全退出并重新打开 Cursor。
