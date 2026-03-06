# Topi MCP 工具参考

## 归属人 (owner)

每个任务有 `owner` 字段，显式声明由 human 还是 agent 创建/完成：

| 取值 | 含义 |
|------|------|
| `human` | 用户（人）创建/完成 |
| `agent` | Agent 通过 MCP 创建/完成 |
| `null` | 历史任务未标记 |

MCP 创建任务时默认 `agent`；可传 `owner: "human"` 表示用户名义。

## 任务工具完整参数

| 工具 | 必填参数 | 可选参数 |
|------|----------|----------|
| `topi_list_tasks` | 无 | `filter`, `listId`, `date`, `startDate`, `endDate`, `owner` |
| `topi_create_task` | `title` | `listId`, `dueDate`, `priority`, `detail`, `owner`, `estimatedHours` |
| `topi_create_tasks` | `tasks`（数组） | 每项含 `title`, `listId?`, `dueDate?`, `priority?`, `detail?`, `owner?`, `estimatedHours?` |
| `topi_update_task` | `id` | `title`, `listId`, `dueDate`, `priority`, `detail`, `owner`, `estimatedHours` |
| `topi_toggle_task` | `id` | 无 |
| `topi_abandon_task` | `id` | 无 |
| `topi_restore_task` | `id` | 无 |
| `topi_trash_task` | `id` | 无 |
| `topi_delete_task` | `id` | 无 |
| `topi_reorder_tasks` | `id`, `newIndex` | `newIndex` 为 0-based 索引 |

## 列表工具

| 工具 | 参数 |
|------|------|
| `topi_list_lists` | 无 |
| `topi_create_list` | `name`（必填） |
| `topi_update_list` | `id`, `name`（必填） |
| `topi_delete_list` | `id`（必填） |

## filter 枚举

`topi_list_tasks` 的 `filter` 取值：

`all`, `today`, `tomorrow`, `recentSeven`, `inbox`, `completed`, `abandoned`, `trash`

- `all`：全部
- `today`：今日
- `tomorrow`：明日
- `recentSeven`：近七日
- `inbox`：收件箱
- `completed`：已完成
- `abandoned`：已放弃
- `trash`：回收站

## 日期格式

ISO 8601：`2026-03-06` 或 `2026-03-06T10:00:00Z`

适用于 `dueDate`、`date`、`startDate`、`endDate`

## priority 枚举

`none`, `low`, `medium`, `high`

默认 `none`

## owner 枚举

`human`, `agent`

- MCP 创建任务默认 `agent`
- `topi_list_tasks` 的 `owner` 参数：`human` | `agent` | `all`（或不传，表示全部）

## estimatedHours（预估耗时）

- 整数小时，≥1，可选
- 用于时间规划；Agent 可根据此字段安排 `dueDate`
