# Topi MCP Tasks Agent Skill 设计文档

> 设计日期：2026-03-06

## 概述

为 Topi 项目创建 Agent Skill，指导 agent 在用户表达任务管理意图（如「记下来」「加到待办」「今天有什么任务」）时，正确使用 Topi MCP 工具完成任务操作。

## 1. 设计决策

- **存储位置**：项目 skill（`topi/.cursor/skills/topi-mcp-tasks/`）
- **主要场景**：用户意图驱动（非开发/测试辅助）
- **结构**：分层结构（SKILL.md + reference.md）

## 2. 目录结构

```
topi/.cursor/skills/topi-mcp-tasks/
├── SKILL.md        # 主指令：触发条件、意图映射、核心工作流（约 150–200 行）
└── reference.md    # 参考：完整工具参数、filter 枚举、日期格式
```

## 3. SKILL.md 内容

### 3.1 YAML 元数据

```yaml
---
name: topi-mcp-tasks
description: Use Topi MCP tools for task management when user asks to add, list, update, complete, or manage todo tasks. Triggers on phrases like "记下来"、"加到待办"、"今天有什么任务"、"完成这个任务".
---
```

### 3.2 前提条件

- 使用前需确保 agent MCP 已配置 topi 服务器（见 `README.md` 或 `topi-api/docs/MCP.md`）
- 若 MCP 调用失败，提示用户检查：Topi API 是否运行、Token 是否有效

### 3.3 意图 → 工具映射表

| 用户意图 | 推荐工具 | 备注 |
|----------|----------|------|
| 记下/添加任务 | `topi_create_task` | 若指定列表，先 `topi_list_lists` 取 listId |
| 批量添加 | `topi_create_tasks` | 多任务时 |
| 列出任务（今天/明天/收件箱/全部等） | `topi_list_tasks` | 用 filter 指定视图 |
| 完成任务 | `topi_toggle_task` | 按 id 切换 |
| 更新任务 | `topi_update_task` | 需任务 id |
| 放弃/删除/恢复任务 | `topi_abandon_task` / `topi_trash_task` / `topi_restore_task` | 按 id |
| 创建/列出列表 | `topi_create_list` / `topi_list_lists` | — |

### 3.4 核心工作流

**创建任务（含指定列表）：**

1. 用户指定列表名 → 调用 `topi_list_lists` 找到对应 id
2. 调用 `topi_create_task`，传入 `title`、`listId`（若需要）、`dueDate`（若需要）、`priority`（若需要）

**列出任务：**

- 用户说「今天」「明天」「收件箱」「已完成」等 → 调用 `topi_list_tasks`，设置对应 `filter`（today / tomorrow / inbox / completed 等）

**批量创建：**

- 用户一次给多个任务 → 调用 `topi_create_tasks`，传入 `tasks` 数组

### 3.5 渐进披露

- 完整参数与枚举见 [reference.md](reference.md)

## 4. reference.md 内容

### 4.1 任务工具完整参数

| 工具 | 必填参数 | 可选参数 |
|------|----------|----------|
| `topi_list_tasks` | 无 | `filter`, `listId`, `date`, `startDate`, `endDate` |
| `topi_create_task` | `title` | `listId`, `dueDate`, `priority`, `detail` |
| `topi_create_tasks` | `tasks`（数组） | 每项含 `title`, `listId?`, `dueDate?`, `priority?`, `detail?` |
| `topi_update_task` | `id` | `title`, `listId`, `dueDate`, `priority`, `detail` |
| `topi_toggle_task` 等 | `id` | 无 |
| `topi_reorder_tasks` | `id`, `newIndex` | 无 |

### 4.2 列表工具

| 工具 | 参数 |
|------|------|
| `topi_list_lists` | 无 |
| `topi_create_list` | `name`（必填） |
| `topi_update_list` | `id`, `name`（必填） |
| `topi_delete_list` | `id`（必填） |

### 4.3 filter 枚举

`all`, `today`, `tomorrow`, `recentSeven`, `inbox`, `completed`, `abandoned`, `trash`

### 4.4 日期格式

ISO 8601：`2026-03-06` 或 `2026-03-06T10:00:00Z`

### 4.5 priority 枚举

`none`, `low`, `medium`, `high`（默认 `none`）

## 5. 实现后验证

- [ ] SKILL.md 总行数 < 500
- [ ] description 包含触发词（记下来、加到待办、今天有什么任务等）
- [ ] 术语一致（任务、列表、filter 等）
- [ ] reference.md 链接在 SKILL.md 中正确
