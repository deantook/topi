# 垃圾桶一键清理 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 垃圾桶页面增加「一键清理」按钮，点击确认后调用后端批量删除接口，永久清空垃圾桶。

**Architecture:** 后端新增 `DELETE /tasks/trash` 及 Service/Repo 层；前端 use-tasks 增加 clearTrash，TaskList 在 mode=trash 时显示按钮与确认弹窗。

**Tech Stack:** Go (Gin, GORM), React, TypeScript, shadcn AlertDialog

**设计参考:** `docs/plans/2025-03-06-trash-clear-button-design.md`

---

## Task 1: Repository - DeleteByUserIDAndStatus

**Files:**
- Modify: `topi-api/internal/repository/task_repo.go`

**Step 1: 添加方法**

在 `Delete` 方法之后添加：

```go
// DeleteByUserIDAndStatus deletes all tasks for userID with the given status.
func (r *TaskRepository) DeleteByUserIDAndStatus(userID, status string) error {
	return r.db.Where("user_id = ? AND status = ?", userID, status).Delete(&model.Task{}).Error
}
```

**Step 2: 验证构建**

```bash
cd topi-api && go build ./...
```

Expected: 成功

**Step 3: Commit**

```bash
git add topi-api/internal/repository/task_repo.go
git commit -m "feat(api): add TaskRepo.DeleteByUserIDAndStatus"
```

---

## Task 2: Service - ClearTrash

**Files:**
- Modify: `topi-api/internal/service/task_service.go`

**Step 1: 添加方法**

在 `Delete` 方法之后添加：

```go
// ClearTrash permanently deletes all trash tasks for the user.
func (s *TaskService) ClearTrash(userID string) error {
	return s.repo.DeleteByUserIDAndStatus(userID, string(model.TaskStatusTrash))
}
```

**Step 2: 验证构建**

```bash
cd topi-api && go build ./...
```

Expected: 成功

**Step 3: Commit**

```bash
git add topi-api/internal/service/task_service.go
git commit -m "feat(api): add TaskService.ClearTrash"
```

---

## Task 3: Handler - ClearTrash 与路由

**Files:**
- Modify: `topi-api/internal/handler/task_handler.go`
- Modify: `topi-api/internal/wire/wire.go`

**Step 1: 添加 Handler 方法**

在 `Delete` 方法之后添加：

```go
func (h *TaskHandler) ClearTrash(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	if err := h.svc.ClearTrash(userID); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}
```

**Step 2: 注册路由**

在 `wire.go` 中，将 `auth.DELETE("/tasks/:id", taskH.Delete)` 之前添加（注意顺序，`/tasks/trash` 必须在 `/tasks/:id` 之前）：

```go
auth.DELETE("/tasks/trash", taskH.ClearTrash)
auth.DELETE("/tasks/:id", taskH.Delete)
```

**Step 3: 验证构建**

```bash
cd topi-api && go build ./...
```

Expected: 成功

**Step 4: 更新 Swagger（可选）**

```bash
make swagger
```

**Step 5: Commit**

```bash
git add topi-api/internal/handler/task_handler.go topi-api/internal/wire/wire.go
git commit -m "feat(api): add DELETE /tasks/trash endpoint"
```

---

## Task 4: use-tasks - clearTrash

**Files:**
- Modify: `topi/app/hooks/use-tasks.ts`

**Step 1: 添加 clearTrash**

在 `deleteTask` 之后、`abandonTask` 之前，添加 `clearTrash`：

```ts
const clearTrash = useCallback(
  async () => {
    try {
      await apiClient.delete("/tasks/trash");
      invalidate();
    } catch (e) {
      console.error("Failed to clear trash:", e);
      throw e; // 让 DeleteConfirmDialog 保持打开，便于重试
    }
  },
  [invalidate]
);
```

**Step 2: 在 return 中导出**

在 `return` 对象中，`deleteTask` 之后添加：

```ts
clearTrash: filter === "trash" ? clearTrash : undefined,
```

注意：只有 `filter === "trash"` 时才有 `clearTrash`，否则返回 `undefined`。

**Step 3: 修改 useTasks 返回类型**

若 TypeScript 推断有问题，可在返回对象中确保 `clearTrash?: () => Promise<void>`。

**Step 4: 验证构建**

```bash
cd topi && pnpm run build
```

Expected: 成功

**Step 5: Commit**

```bash
git add topi/app/hooks/use-tasks.ts
git commit -m "feat(web): add clearTrash to use-tasks when filter is trash"
```

---

## Task 5: TaskList - 一键清理按钮与确认弹窗

**Files:**
- Modify: `topi/app/components/task-list.tsx`

**Step 1: 解构 clearTrash**

在 `const { tasks, ... deleteTask, abandonTask, restoreTask, ... } = tasksSource ?? fallback;` 中增加 `clearTrash`（可能为 undefined）。

**Step 2: 添加 clearTrash 确认状态**

在 `deleteConfirmTaskId` 旁增加：

```ts
const [clearTrashConfirmOpen, setClearTrashConfirmOpen] = useState(false);
```

**Step 3: 在标题行增加按钮**

在 `flex items-center justify-between` 的 header 区域，`showSort` 的 Button 之前或同一行，当 `mode === "trash" && clearTrash` 时渲染：

```tsx
{mode === "trash" && clearTrash && (
  <Button
    variant="outline"
    size="sm"
    disabled={tasks.length === 0 || isClearingTrash}
    onClick={() => setClearTrashConfirmOpen(true)}
    aria-label="一键清理"
  >
    {isClearingTrash ? "清空中…" : "一键清理"}
  </Button>
)}
```

需要添加 `isClearingTrash` 状态：

```ts
const [isClearingTrash, setIsClearingTrash] = useState(false);
```

**Step 4: 添加 DeleteConfirmDialog 用于清空**

在现有的 `DeleteConfirmDialog` 之后，增加第二个弹窗：

```tsx
<DeleteConfirmDialog
  open={clearTrashConfirmOpen}
  onOpenChange={setClearTrashConfirmOpen}
  title="清空垃圾桶？"
  description={`将永久删除垃圾桶内全部 ${tasks.length} 项，无法恢复。`}
  confirmLabel="清空"
  onConfirm={async () => {
    if (!clearTrash) return;
    setIsClearingTrash(true);
    try {
      await clearTrash();
      setClearTrashConfirmOpen(false);
    } finally {
      setIsClearingTrash(false);
    }
  }}
/>
```

**Step 5: 验证构建**

```bash
cd topi && pnpm run build
```

Expected: 成功

**Step 6: 手动测试**

1. 启动 API 与 Web：`make up` 或分别 `make api` 与 `make web`
2. 进入垃圾桶页面 `/trash`
3. 有任务时点击「一键清理」，确认弹窗出现，点击「清空」，列表应清空
4. 无任务时按钮应禁用

**Step 7: Commit**

```bash
git add topi/app/components/task-list.tsx
git commit -m "feat(web): add one-click clear button on trash page"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2025-03-06-trash-clear-button-implementation.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** — Dispatch fresh subagent per task, review between tasks, fast iteration  
2. **Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints  

Which approach?
