# 任务编辑乐观更新设计

> 设计日期：2026-03-04

## 问题

编辑任务名称提交后，会先闪回旧值再显示新值。根因：`updateTask` 先 `await` 接口，再 `setTasks`，但 `handleEditSubmit` 已立即退出编辑，此时 state 仍为旧值。

## 方案：乐观更新

在 `updateTask` 中：先 `setTasks` 更新本地 state，再 `await apiClient.patch`。接口失败时 `fetchTasks` 回滚。

## 改动范围

- `topi/app/hooks/use-tasks.ts`：`updateTask` 内将 `setTasks` 移到 `await apiClient.patch` 之前。
