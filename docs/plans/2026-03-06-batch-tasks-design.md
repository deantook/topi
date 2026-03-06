# 任务页面批量操作

> **Goal:** 在任务页面增加「批量操作」按钮，进入多选模式后可对选中任务进行批量删除、放弃、完成、移入指定清单（含收集箱）。

## 1. 背景与范围

- **当前：** 任务操作均为单条，右键菜单或点击完成。无批量能力。
- **目标：** 通过「批量操作」按钮进入多选模式，选择多项后批量执行操作。
- **适用页面：** 全部、今天、明天、近期7天、收集箱、自定义清单、已完成、已放弃。**不含垃圾桶**。

## 2. 方案概述

采用 **Header 工具栏** 方案：
- 点击「批量操作」进入多选模式，标题栏显示操作按钮，每行左侧出现选择 checkbox
- 再次点击「批量操作」退出
- 新增后端批量 API，前端 `useTasks` 或新 hook 封装调用

## 3. 后端 API

### 3.1 批量接口

**路由顺序：** 必须注册在 `/tasks/:id` 之前，避免 `batch` 被当作 id。

| 路由 | 方法 | 请求体 | 说明 |
|------|------|--------|------|
| `/tasks/batch/trash` | POST | `{ "ids": ["id1", ...] }` | 移至垃圾桶 |
| `/tasks/batch/abandon` | POST | `{ "ids": ["id1", ...] }` | 放弃 |
| `/tasks/batch/toggle` | POST | `{ "ids": ["id1", ...] }` | 切换完成状态 |
| `/tasks/batch/restore` | POST | `{ "ids": ["id1", ...] }` | 从已放弃/垃圾桶恢复 |
| `/tasks/batch/move` | POST | `{ "ids": ["id1", ...], "listId": "xxx" \| null }` | 移入指定清单（null = 收集箱） |

- 所有接口需 auth 中间件，校验任务归属 userID
- 复用现有 TaskService 单任务逻辑，批量循环调用

### 3.2 错误策略

- 部分成功/失败：采用「全成功或全失败」语义，任一项失败则整体返回 4xx，不提交
- 或：返回 200 + `{ processed, failed, errors }`，由产品定夺

## 4. 前端 UI 与交互

### 4.1 进入/退出多选模式

- Header 右侧新增「批量操作」按钮（与排序、一键清理同排）
- 点击进入：按钮高亮；每行左侧显示**选择 checkbox**（与完成 checkbox 分离）
- 再次点击退出：清空选中，隐藏选择 checkbox

### 4.2 选择 checkbox 与完成 checkbox

- **选择 checkbox**：左侧，仅用于批量操作选中
- **完成 checkbox**：右侧，行为与现有一致（勾选/取消完成）
- 两者互不影响

### 4.3 按 mode 显示的操作

| 页面 (mode) | 批量操作 |
|-------------|----------|
| 活跃 (default) | 删除、放弃、完成、移入清单 |
| 已完成 (completed) | 删除、放弃、移入清单 |
| 已放弃 (abandoned) | 删除、恢复、完成、移入清单 |

- 未选中时，操作按钮全部 disabled
- 选中后显示当前 mode 对应的操作

### 4.4 移入指定清单

- 「移入清单」为 DropdownMenu 触发器
- 展开后：第一项「收集箱」，下接自定义清单列表
- 点击某项后批量更新选中任务的 listId（收集箱 = null）

### 4.5 确认与反馈

- 删除/放弃/永久删除：复用 DeleteConfirmDialog，文案如「将 3 个任务移至垃圾桶？」
- 成功后：toast（如「已删除 3 个任务」），invalidate 刷新

### 4.6 拖拽

- 多选模式下暂时关闭 DnD 排序，避免与多选冲突；退出后恢复

## 5. 数据流

- `TaskList` 增加 `isBatchMode`、`selectedIds: Set<string>`
- `useTasks` 或新建 `useBatchTasks` 提供 `batchTrash`、`batchAbandon`、`batchToggle`、`batchRestore`、`batchMove`
- 操作成功后 invalidate dashboard + tasks 相关 query

## 6. 错误处理

- 网络/5xx：toast「操作失败，请重试」
- 4xx：toast 错误信息，invalidate 刷新
- 操作中：按钮 loading 或禁用，防止重复提交

## 7. 不做（YAGNI）

- 全选/反选（可后续加）
- 批量编辑截止日期、优先级（可后续加）
- 垃圾桶页面批量操作
