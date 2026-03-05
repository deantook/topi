# 任务预估耗时字段设计文档

> 设计日期：2026-03-06

## 概述

为任务增加「预估耗时」字段（`estimated_hours`），按整数小时计。供用户与 Agent 共同使用：用户用于规划时间，Agent 用于安排截止日期。涉及 Model、API、MCP 及 Agent Skill 的完整集成。

## 1. 需求约束

| 项目 | 决策 |
|------|------|
| 使用对象 | 用户 + Agent |
| 精度 | 整数小时（1、2、3） |
| 取值范围 | 正整数，不设上限 |
| 可选性 | 可选，nil 表示未设置 |

## 2. 数据模型

| 项目 | 说明 |
|------|------|
| 字段名 | `estimated_hours` |
| Go 类型 | `*int` |
| 数据库 | `INT`，nullable |
| 约束 | 若不为 nil，则 ≥ 1 |

与 `priority`、`detail` 一样作为可选字段。

## 3. API 约定

- **REST**：请求/响应使用 `estimated_hours`（snake_case）
- **MCP**：工具参数使用 `estimatedHours`（camelCase）

## 4. 涉及范围

### 4.1 Model 与 Migration

- `topi-api/internal/model/task.go`：`Task` 增加 `EstimatedHours *int`
- `topi-api/docs/migrations/add_tasks_estimated_hours.sql`：新增列

### 4.2 REST API

| 接口 | 变更 |
|------|------|
| `POST /tasks` | 请求体支持 `estimated_hours` |
| `POST /tasks/batch` | 每项任务支持 `estimated_hours` |
| `PATCH /tasks/:id` | 支持 `estimated_hours` |
| `GET /tasks`、`GET /tasks/:id` | 响应包含 `estimated_hours` |

### 4.3 MCP 工具

| 工具 | 变更 |
|------|------|
| `topi_list_tasks` 返回 | 增加 `estimated_hours` |
| `topi_create_task` | 可选参数 `estimatedHours` |
| `topi_create_tasks` | 每项支持 `estimatedHours` |
| `topi_update_task` | 可选参数 `estimatedHours` |

### 4.4 Agent Skill

- **SKILL.md**：在添加/更新意图中说明可传 `estimatedHours`；**新增「根据预估耗时安排截止时间」的指引**
- **reference.md**：工具参数表补充 `estimatedHours`

**Skill 核心指引（Agent 根据预估耗时安排 dueDate）：**

> 当用户添加任务并附带预估耗时（或 Agent 能从任务描述中推断大致耗时）时，Agent 应结合 `estimatedHours` 为任务设置合理的 `dueDate`。例如：用户说「把这三件事都记下来，分别是 2 小时、1 小时、3 小时」，Agent 创建任务时传入 `estimatedHours`，并可基于当前时间或用户指定起始时间，按累计耗时自动分配 `dueDate`，帮助用户合理安排日程。

## 5. 错误处理

- 传入 0、负数、小数或非数字 → 返回 400 / MCP `isError`，提示「estimated_hours 需为正整数」

## 6. 文档同步

- `topi-api/docs/MCP.md`：任务工具参数表补充 `estimatedHours`
