# 任务归属者字段设计文档

> 设计日期：2026-03-06

## 概述

为任务增加 `owner`（归属者）字段，取值 `human` | `agent` | `null`。用于：A) 列表筛选、B) 界面区分展示、C) 预留权限/行为扩展。创建时可指定或按来源自动设置，创建后可修改。历史任务迁移为 `null`。

## 1. 数据模型与迁移

**模型变更（`topi-api/internal/model/task.go`）**

- 新增枚举 `TaskOwner`：`TaskOwnerHuman`、`TaskOwnerAgent`
- `Task` 结构体新增：`Owner *TaskOwner`（`json:"owner"`），序列化值为 `"human"` | `"agent"` | `null`
- 创建时根据来源默认：REST API → `human`，MCP → `agent`（MCP 可显式传 `owner: "human"`）

**数据库迁移**

- 新增列：`owner VARCHAR(8) NULL`
- 现有数据该列保持 `NULL`
- 可选：对 `owner` 建索引

## 2. API 与 MCP 集成

**REST API**

| 接口 | 变更 |
|------|------|
| `POST /tasks`、`POST /tasks/batch` | 请求体可选 `owner`，未传则按来源默认 |
| `PATCH /tasks/:id` | 请求体可选 `owner`，可修改 |
| `GET /tasks` | 查询参数 `owner`：`human` \| `agent` \| `all`（或不传） |
| 响应 | 任务对象包含 `owner` 字段 |

**MCP**

- `CreateTask` / `CreateTasks`：可选参数 `owner`（`"human"` | `"agent"`），未传默认 `"agent"`
- `UpdateTask`：支持 `owner` 参数
- `ListTasks`：支持 `owner` 参数，返回含 `owner`

**Service 层**

- `Create`、`BatchCreate`、`Update` 增加 `owner` 参数
- 列表查询支持 `owner` 过滤，Repository `ListByUserID` 等支持 `owner` 条件

## 3. 前端展示与筛选

**数据层（`use-tasks.ts`）**

- `Task` 接口新增 `owner: "human" | "agent" | null`
- `addTask` 创建时传 `owner: "human"`
- `updateTask` 支持 `owner` 更新
- `filterToQuery`、`useTasks` 支持 `owner` 查询参数

**筛选 UI**

- 任务页面标题旁增加：**全部 | 我 | Agent**
- URL 反映筛选：`/today?owner=human` 等

**任务行展示**

- 标题旁显示归属者图标：`human` → User，`agent` → Bot/Sparkles，`null` → 不显示或「未知」

**详情面板**

- 显示当前归属者，支持切换（下拉/单选）并调用 `updateTask(id, { owner })`

**常量（`task-constants.ts`）**

- `OWNER_LABEL`：`{ human: "我", agent: "Agent", null: "未知" }`

## 4. 错误处理与边界情况

- 创建/更新：`owner` 只接受 `"human"` 或 `"agent"`，否则 400
- 列表 `owner` 参数：无效值按「全部」处理
- 前端：API 返回的陌生 `owner` 值映射为 `null`
- 筛选时 `owner=null` 的任务：仅出现在「全部」，不出现在「我」或「Agent」
- 不传 `owner` 的旧客户端：兼容，新字段为 `null` 或默认值

## 5. 权限与行为（C）说明

当前仅实现数据记录、筛选与展示。不做权限控制：用户可修改任意任务（含 agent 创建）。如需「agent 任务仅 agent 可修改」等规则，可后续扩展。
