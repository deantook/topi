---
name: topi-mcp-tasks
description: Use Topi MCP tools for task management when user asks to add, list, update, complete, or manage todo tasks. Triggers on phrases like "记下来"、"加到待办"、"今天有什么任务"、"完成这个任务".
---

# Topi MCP Tasks

## 前提条件

- 使用前需确保 Cursor MCP 已配置 topi 服务器（见 [README.md](../../../README.md) 或 [topi-api/docs/MCP.md](../../../topi-api/docs/MCP.md)）
- 若 MCP 调用失败，提示用户检查：Topi API 是否运行、Token 是否有效

## 意图 → 工具映射

| 用户意图 | 推荐工具 | 备注 |
|----------|----------|------|
| 记下/添加任务 | `topi_create_task` | 若指定列表，先 `topi_list_lists` 取 listId |
| 批量添加 | `topi_create_tasks` | 多任务时 |
| 列出任务（今天/明天/收件箱/全部等） | `topi_list_tasks` | 用 filter 指定视图 |
| 完成任务 | `topi_toggle_task` | 按 id 切换 |
| 更新任务 | `topi_update_task` | 需任务 id |
| 放弃/删除/恢复任务 | `topi_abandon_task` / `topi_trash_task` / `topi_restore_task` | 按 id |
| 创建/列出列表 | `topi_create_list` / `topi_list_lists` | — |

## 核心工作流

### 创建任务（含指定列表）

1. 用户指定列表名 → 调用 `topi_list_lists` 找到对应 id
2. 调用 `topi_create_task`，传入 `title`、`listId`（若需要）、`dueDate`（若需要）、`priority`（若需要）

### 列出任务

用户说「今天」「明天」「收件箱」「已完成」等 → 调用 `topi_list_tasks`，设置对应 `filter`（today / tomorrow / inbox / completed 等）

### 批量创建

用户一次给多个任务 → 调用 `topi_create_tasks`，传入 `tasks` 数组

## 详细参考

完整参数与枚举见 [reference.md](reference.md)
