# 任务批量新建设计文档

> 设计日期：2026-03-05

## 概述

为任务增加批量新建能力，主要支持 AI（如 agent）一次创建多条任务。新增 `POST /api/v1/tasks/batch` 和 MCP 工具 `topi_create_tasks`，与现有单条接口并存。暂不限制批量大小，全成功或全失败，使用事务保证一致性。

## 1. API 与数据结构

**HTTP API**

- `POST /api/v1/tasks/batch`
- Body:

```json
{
  "tasks": [
    { "title": "任务1", "listId": null, "dueDate": "2026-03-06", "priority": "none" },
    { "title": "任务2", "listId": "xxx", "dueDate": null, "priority": "high" }
  ]
}
```

- 每项：`title`（必填）、`listId`（可选）、`dueDate`（可选）、`priority`（可选，默认 none）
- 成功：`{ "data": [{ "id", "title", ... }, ...] }`，格式与单条 Create 一致
- 失败：任一校验失败则整批失败，返回 400，不写入 DB

**MCP**

- `topi_create_tasks`
- 参数：`tasks`（必填，数组，每项含 title、listId?、dueDate?、priority?）
- 成功：返回已创建任务 JSON
- 失败：`isError: true` 及错误描述

## 2. 实现与错误处理

**Service 层：BatchCreate**

- 签名：`BatchCreate(userID string, tasks []BatchTaskInput, loc *time.Location) ([]*model.Task, error)`
- `BatchTaskInput`：`{ Title, ListID, DueDate, Priority }`
- 先校验全部任务，任一项不合格即返回 error
- 通过后按顺序创建，order 递增，使用事务（全成功 commit，任一步失败 rollback）

**Handler 层**

- `CreateTasksBatchReq { Tasks []CreateTaskReq }`
- 调用 `TaskService.BatchCreate`，用 `formatTaskForResponse` 格式化返回

**MCP Handler**

- `CreateTasks(ctx, req)`：从 req 取 tasks 数组，调用 `TaskService.BatchCreate`
- 返回 JSON 或 `NewToolResultError`

**错误处理**

- 任一项校验失败 → 返回具体错误（如 `task[2].dueDate: invalid format`）
- 全成功或全失败，无部分成功

**空数组**

- `tasks` 为空：HTTP 400，MCP `isError: true`，提示至少需要一条

## 3. 路由与集成

**HTTP 路由**

- 在 auth 组下：`auth.POST("/tasks/batch", taskH.CreateBatch)`，置于 `POST /tasks/reorder` 之前

**MCP**

- 在 `mcpsetup/server.go` 注册 `topi_create_tasks`，绑定 `taskH.CreateTasks`

**Swagger**

- 为 `POST /api/v1/tasks/batch` 补充注解
