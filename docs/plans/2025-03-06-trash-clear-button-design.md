# 垃圾桶页面一键清理按钮 - 设计文档

> **Goal:** 垃圾桶页面增加「一键清理」按钮，永久删除当前用户垃圾桶内全部任务，需确认弹窗。

## 1. 背景

- **现状：** 垃圾桶页面（`/trash`）只能单条恢复或永久删除，无批量操作。
- **需求：** 一键永久删除全部 trash 任务，不可恢复。

## 2. 方案：后端批量删除 API

选用后端新增批量删除接口，一次请求完成，性能更好。

## 3. API 设计

- **方法：** `DELETE`
- **路径：** `/tasks/trash`
- **说明：** 永久删除当前用户 status=trash 的所有任务
- **路由顺序：** 须在 `DELETE /tasks/:id` 之前注册，否则 `trash` 会被当作 id
- **响应：** 200 `{"ok": true}`

## 4. 后端改动

1. **Repository：** `TaskRepository.DeleteByUserIDAndStatus(userID, status string)`，执行 `DELETE FROM tasks WHERE user_id = ? AND status = ?`
2. **Service：** `TaskService.ClearTrash(userID)` 调用 `DeleteByUserIDAndStatus(userID, "trash")`
3. **Handler：** `TaskHandler.ClearTrash` 读取 userID，调用 service，返回 200

## 5. 前端改动

1. **use-tasks：** 当 `filter === "trash"` 时返回 `clearTrash`，内部调用 `DELETE /tasks/trash`，成功后 `invalidate()`
2. **TaskList：** `mode === "trash"` 时在标题行右侧增加「一键清理」按钮；空列表时禁用
3. **确认弹窗：** 复用 `DeleteConfirmDialog`，标题「清空垃圾桶？」，描述「将永久删除垃圾桶内全部 X 项，无法恢复。」，确认按钮「清空」
4. **Loading：** 执行中按钮 loading，防止重复点击

## 6. 错误处理

- 后端：出错返回 500，沿用 `response.Error` 格式
- 前端：失败时保持弹窗打开，便于重试

## 7. 测试

- 后端：为 `ClearTrash` 编写单元测试（可选，视项目习惯）
- 前端：手动测试或集成测试
