# Topi MCP (Cursor 配置)

Topi 通过 MCP (Model Context Protocol) 暴露任务与列表管理工具，可在 Cursor 中配置使用。

## 传输方式

- **Transport**: SSE (Server-Sent Events)
- **URL**: `http://localhost:8080/mcp/sse?token=YOUR_JWT`

## 获取 JWT Token

1. 启动 Topi 前端与 API
2. 在前端登录
3. 打开浏览器开发者工具 → Application → Local Storage
4. 找到 `token` 键，复制其值即为 JWT

## Cursor 配置示例

在 Cursor 的 MCP 配置（Cursor Settings → Features → MCP → Open Configuration File）中添加：

```json
{
  "mcpServers": {
    "topi": {
      "url": "http://localhost:8080/mcp/sse?token=YOUR_JWT"
    }
  }
}
```

将 `YOUR_JWT` 替换为实际 token。保存后重启 Cursor，并在 Settings → Tools & MCP 中启用 topi 服务器（SSE 服务器默认需手动启用）。

### 可选：使用 Header 传递 Token

若希望通过 header 传递 token（避免出现在 URL 中）：

```json
{
  "mcpServers": {
    "topi": {
      "url": "http://localhost:8080/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_JWT"
      }
    }
  }
}
```

## 本地测试（可选）

若环境支持通过环境变量注入 token（如 `TOPI_TOKEN`），可将 URL 配置为：

```
http://localhost:8080/mcp/sse?token=${TOPI_TOKEN}
```

具体是否支持取决于 MCP 客户端实现。

## 认证说明

- MCP  endpoint 与 REST API 使用相同的 JWT 认证
- Token 可通过 query 参数 `token` 或 `Authorization: Bearer <token>` 传递
- Token 过期后需重新登录获取新 token 并更新配置
