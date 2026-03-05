---
name: topi-mcp-tasks
description: Use Topi MCP tools when user manages todo tasks. Triggers: 记下来/加到待办/帮我记一下/添加任务、预估耗时/几小时、今天有什么任务/明天要做什么、收件箱里有什么、完成/标记完成、改标题/改日期/调优先级/设预估耗时。
---

# Topi MCP Tasks

## 使用场景 / 触发词

| 场景 | 示例表达 |
|------|----------|
| **添加** | 记下来、加到待办、帮我记一下、添加任务、把 X 列入计划、提醒我 X、别忘了 X、写进 todo |
| **批量添加** | 把这几项都加上、这些都记下来、批量创建 |
| **查看** | 今天有什么任务、明天要做什么、收件箱里有什么、看看我的待办、列出所有任务、本周任务、已完成的有哪些 |
| **完成** | 完成这个任务、标记为已完成、勾掉、打勾 |
| **更新** | 改下标题、移到明天、换个日期、设个优先级、设个预估耗时 |
| **放弃/删除** | 放弃、删掉、移到回收站、不要了 |
| **恢复** | 恢复这个任务、从回收站捞回来 |
| **列表** | 创建新列表、我有哪些列表、把这个加到 X 列表 |
| **排序** | 排下顺序、把这个挪到第一位 |

## 归属人 (owner)

每个任务有 `owner` 字段，显式声明归属方：

| 取值 | 含义 |
|------|------|
| `human` | 由用户（人）创建或完成 |
| `agent` | 由 Agent（通过 MCP）创建或完成 |
| `null` | 历史任务未标记 |

**规则：**

- Agent 通过 MCP 创建任务时，**必须**显式传递 `owner: "agent"`（MCP 默认即为 agent，但建议在批量创建等场景显式声明）
- 用户要求「以我的名义记下」「算我创建的」时，传 `owner: "human"`
- 列出任务时可按 `owner` 筛选：`human` / `agent` / `all`

## 预估耗时 (estimatedHours)

任务可设置预估耗时（整数小时），用于时间规划。

**规则：**
- 创建/更新任务时，可选传入 `estimatedHours`（正整数）
- 当用户添加任务并附带预估耗时，或 Agent 能从描述推断耗时，应传入此字段
- **安排截止时间：** Agent 应根据 `estimatedHours` 为任务设置合理的 `dueDate`。例如用户说「把这三件事记下来，各 2 小时、1 小时、3 小时」，创建时传入 `estimatedHours`，并可基于当前时间或用户指定起始时间，按累计耗时自动分配 `dueDate`

## 前提条件

- 使用前需确保 Cursor MCP 已配置 topi 服务器（见 [README.md](../../../README.md) 或 [topi-api/docs/MCP.md](../../../topi-api/docs/MCP.md)）
- 若 MCP 调用失败，提示用户检查：Topi API 是否运行、Token 是否有效

## 意图 → 工具映射

| 用户意图 | 推荐工具 | 备注 |
|----------|----------|------|
| 记下/添加任务 | `topi_create_task` | 若指定列表，先 `topi_list_lists` 取 listId |
| 批量添加 | `topi_create_tasks` | 多任务时 |
| 列出任务（今天/明天/收件箱/全部等） | `topi_list_tasks` | 用 filter 指定视图，可用 owner 筛选 |
| 完成任务 | `topi_toggle_task` | 按 id 切换 |
| 更新任务 | `topi_update_task` | 需任务 id |
| 放弃/删除/恢复任务 | `topi_abandon_task` / `topi_trash_task` / `topi_restore_task` | 按 id |
| 重排序 | `topi_reorder_tasks` | `id` + `newIndex`（0-based） |
| 创建/列出列表 | `topi_create_list` / `topi_list_lists` | — |

## 核心工作流

### 创建任务（含指定列表）

1. 用户指定列表名 → 调用 `topi_list_lists` 找到对应 id
2. 调用 `topi_create_task`，传入 `title`、`listId`（若需要）、`dueDate`（若需要）、`priority`（若需要）、`estimatedHours`（若需要）、`owner`（Agent 创建传 `"agent"`，用户要求记在自己名下传 `"human"`）

### 列出任务

用户说「今天」「明天」「收件箱」「已完成」等 → 调用 `topi_list_tasks`，设置对应 `filter`（today / tomorrow / inbox / completed 等）

### 批量创建

用户一次给多个任务 → 调用 `topi_create_tasks`，传入 `tasks` 数组；每项可含 `owner`、`estimatedHours`，Agent 代为创建时建议显式 `owner: "agent"`；若有预估耗时，可据此安排 `dueDate`

## 详细参考

完整参数与枚举见 [reference.md](reference.md)
