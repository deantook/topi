# Topi MCP Server 设计文档

> 设计日期：2026-03-05

## 概述

在 topi-api 中内嵌 MCP (Model Context Protocol) server，使 Cursor 等 AI 助手能通过 MCP 工具直接操作 Topi 的待办和清单。采用 SSE transport，认证通过 query 参数或 header 携带 JWT，暴露任务和清单的完整 CRUD 能力。

## 1. 架构

- MCP 作为 topi-api 的一部分，复用 Gin、GORM、Service 层。
- 路由：`GET /mcp/sse`（SSE 连接）、`POST /mcp/messages`（客户端消息）。
- 使用 MCP Go SDK（`modelcontextprotocol/go-sdk` 或 `metoro-io/mcp-golang`）实现 JSON-RPC 2.0。
- MCP 层直接调用 `TaskService`、`ListService`，不经 HTTP API，避免重复网络开销。

**模块划分：**

```
topi-api/internal/
├── mcp/                    # 新增
│   ├── server.go           # MCP server 初始化、SSE transport
│   ├── tools.go            # 工具注册与路由
│   └── handlers/
│       ├── task_handlers.go
│       └── list_handlers.go
```

依赖注入：通过 Wire 注入 `TaskService`、`ListService`、`jwt.Helper` 到 MCP server。

## 2. MCP Tools

### 任务类

| Tool 名称 | 描述 | 参数 |
|-----------|------|------|
| `topi_list_tasks` | 列出任务 | `filter`（all/today/tomorrow/recentSeven/inbox/completed/abandoned/trash）、`listId`（可选）、`date`（可选）、`startDate`/`endDate`（可选） |
| `topi_create_task` | 创建任务 | `title`（必填）、`listId`（可选）、`dueDate`（可选，ISO8601）、`priority`（可选，none/low/medium/high） |
| `topi_update_task` | 更新任务 | `id`（必填）、`title`（可选）、`listId`（可选）、`dueDate`（可选）、`priority`（可选） |
| `topi_toggle_task` | 切换完成状态 | `id`（必填） |
| `topi_abandon_task` | 放弃任务 | `id`（必填） |
| `topi_restore_task` | 从放弃/回收站恢复 | `id`（必填） |
| `topi_trash_task` | 移入回收站 | `id`（必填） |
| `topi_delete_task` | 永久删除 | `id`（必填） |
| `topi_reorder_tasks` | 重排序 | `id`（必填）、`newIndex`（必填，0-based） |

### 清单类

| Tool 名称 | 描述 | 参数 |
|-----------|------|------|
| `topi_list_lists` | 列出所有清单 | 无 |
| `topi_create_list` | 创建清单 | `name`（必填） |
| `topi_update_list` | 更新清单名称 | `id`（必填）、`name`（必填） |
| `topi_delete_list` | 删除清单 | `id`（必填） |

命名约定：`topi_` 前缀避免与其他 MCP 工具冲突。返回格式：统一 `type: "text"` 的 JSON 或结构化文本，便于 AI 解析。

## 3. 认证与鉴权

**建立连接时：**
- 支持 `GET /mcp/sse?token=<JWT>` 或 `Authorization: Bearer <JWT>`
- 校验 JWT，解析 `userID`，存入 SSE 会话上下文
- 无效或过期返回 401，不建立会话

**工具调用时：**
- 所有 tool 从会话获取 `userID`
- Service 调用统一传 `userID`

**Token 来源：** 用户从 Topi 前端登录后获取 JWT，在 Cursor MCP 配置的 URL 中附带（如 `?token=xxx`）。

**可选：** 支持环境变量 `TOPI_TOKEN` 覆盖，便于本地测试。

## 4. 数据流与调用链

1. **连接：** Cursor → `GET /mcp/sse?token=JWT` → 校验 → 创建会话（绑定 userID）→ 返回 SSE 流
2. **调用：** Cursor → `POST /mcp/messages`（session_id + JSON-RPC）→ 路由到 tool handler → 调用 Service → 封装 ToolResult → 返回
3. 不经过 `task_handler.go`、`list_handler.go`，直接调用 Service
4. 时区：复用 `X-Timezone` 或默认 UTC

## 5. 错误处理

**协议层：** JSON-RPC `error`（Unknown tool、Invalid arguments、Invalid session、Internal server error）

**业务层：** `result.isError: true`，`content` 中描述（任务不存在、越权等）

不暴露栈、DB 等敏感信息。可选：工具调用 30s 超时。

## 6. 依赖与实现注意事项

- **依赖：** `github.com/modelcontextprotocol/go-sdk` 或 `github.com/metoro-io/mcp-golang`
- **路由：** `GET /mcp/sse`、`POST /mcp/messages`，不走 `/api/v1` 和现有 Auth 中间件
- **测试：** 单元测试各 handler；集成测试用 mcprc/curl 验证 SSE + tools/call
- **CORS：** 桌面应用一般不需要；若需跨域再配置
