# MCP 令牌认证功能设计文档

> 设计日期：2026-03-06

## 概述

将 MCP 认证从「登录 JWT」改为「专用 MCP 令牌」，每个用户可有一个长期有效的 MCP 令牌，在设置页生成、查看、撤销。MCP 路由不再接受 JWT，仅接受 MCP 令牌。

## 1. 需求与目标

- **长期有效**：MCP 令牌不过期，除非用户主动撤销
- **专用用途**：与登录 JWT 分离，可独立撤销或轮换
- **配置体验**：在设置页一键生成/复制，无需从 Local Storage 手动复制
- **每用户一个**：每个用户仅允许一个 MCP 令牌

## 2. 数据模型与存储

**User 模型变更**（`topi-api/internal/model/user.go`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `McpTokenHash` | `*string`（可空） | SHA-256(mcp_token)，用于校验 |
| `McpTokenPrefix` | `string`（可空） | 展示用，如 `topi_aB3x...` |

**令牌格式**：`topi_` + 8 位随机字符（a-z, A-Z, 0-9），总长约 13 字符。

**迁移**：GORM AutoMigrate 新增两列，默认 NULL。

## 3. API 设计

**路由**（`/api/v1`，需登录 JWT）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/mcp-token` | 查看状态。返回 `{ hasToken: bool, prefix?: string }` |
| `POST` | `/mcp-token` | 生成或重新生成。若已有则作废后创建新令牌。返回 `{ token: string }` + 提示 |
| `DELETE` | `/mcp-token` | 撤销 |

## 4. MCP 认证中间件

- MCP 路由移除 `middleware.Auth(jwtHelper)`
- 使用新 MCP Token 中间件：提取 token → SHA256 → 按 `mcp_token_hash` 查 User → 注入 userID
- JWT 仅用于 REST API（`/api/v1/*`），MCP 仅认 MCP 令牌

## 5. 设置页 UI

- 在设置页顶部新增「MCP 令牌」区块
- 无令牌：说明 +「生成令牌」按钮
- 有令牌：显示前缀 +「重新生成」「撤销」按钮
- 生成后弹窗/内联展示完整 token 一次，提供复制按钮和 Cursor 配置示例

## 6. 错误处理与安全

- Token 缺失/无效/已撤销 → 401，不区分具体原因
- 令牌明文仅在一次响应中返回
- 设置页仅显示前缀
