# 任务批量操作 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在任务页面增加「批量操作」按钮，进入多选模式后可对选中任务批量删除、放弃、完成、移入指定清单（含收集箱）。

**Architecture:** 后端新增 5 个批量 API（trash/abandon/toggle/restore/move），复用 TaskService 单任务逻辑循环调用；前端 TaskList 增加 isBatchMode 与 selectedIds，Header 工具栏展示操作按钮，每行左侧增加选择 checkbox。适用页面：全部、今天、明天、近期7天、收集箱、自定义清单、已完成、已放弃；不含垃圾桶。

**Tech Stack:** Go (gin, gorm), React, TanStack Query, shadcn/ui, Radix DropdownMenu

---

## Task 1: 后端 TaskService 批量方法

**Files:**
- Modify: `topi-api/internal/service/task_service.go`

**Step 1: 添加 BatchTrash、BatchAbandon、BatchToggle、BatchRestore、BatchMove 方法**

在 `ClearTrash` 之后添加：

```go
// BatchTrash moves multiple tasks to trash. Returns error on first failure.
func (s *TaskService) BatchTrash(userID string, ids []string) error {
	for _, id := range ids {
		if err := s.MoveToTrash(userID, id); err != nil {
			return err
		}
	}
	return nil
}

// BatchAbandon abandons multiple tasks.
func (s *TaskService) BatchAbandon(userID string, ids []string) error {
	for _, id := range ids {
		if err := s.Abandon(userID, id); err != nil {
			return err
		}
	}
	return nil
}

// BatchToggle toggles completion for multiple tasks.
func (s *TaskService) BatchToggle(userID string, ids []string) error {
	for _, id := range ids {
		if err := s.Toggle(userID, id); err != nil {
			return err
		}
	}
	return nil
}

// BatchRestore restores multiple tasks from abandoned/trash.
func (s *TaskService) BatchRestore(userID string, ids []string) error {
	for _, id := range ids {
		if err := s.Restore(userID, id); err != nil {
			return err
		}
	}
	return nil
}

// BatchMove moves multiple tasks to a list (listID nil = inbox). Uses repo directly to support list_id=NULL.
func (s *TaskService) BatchMove(userID string, ids []string, listID *string) error {
	var listIDVal interface{}
	if listID != nil {
		listIDVal = *listID
	} else {
		listIDVal = nil
	}
	for _, id := range ids {
		if _, err := s.repo.GetByIDAndUserID(id, userID); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTaskNotFound
			}
			return err
		}
		if err := s.repo.UpdateFields(id, userID, map[string]interface{}{"list_id": listIDVal}); err != nil {
			return err
		}
	}
	return nil
}
```

**Step 2: 验证编译**

```bash
cd topi-api && go build ./...
```

Expected: 成功

**Step 3: Commit**

```bash
git add topi-api/internal/service/task_service.go
git commit -m "feat(service): add batch task methods"
```

---

## Task 2: 后端 TaskHandler 批量接口

**Files:**
- Modify: `topi-api/internal/handler/task_handler.go`

**Step 1: 定义批量请求体并添加 handler 方法**

在 `CreateTasksBatchReq` 之后添加：

```go
type BatchIDsReq struct {
	IDs []string `json:"ids" binding:"required,dive,uuid"`
}

type BatchMoveReq struct {
	IDs    []string `json:"ids" binding:"required,dive,uuid"`
	ListID *string  `json:"listId"`
}
```

在 `CreateBatch` 之后、`Update` 之前，添加 5 个 handler：

```go
func (h *TaskHandler) BatchTrash(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req BatchIDsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.IDs) == 0 {
		response.Error(c, http.StatusBadRequest, "ids required")
		return
	}
	if err := h.svc.BatchTrash(userID, req.IDs); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) BatchAbandon(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req BatchIDsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.IDs) == 0 {
		response.Error(c, http.StatusBadRequest, "ids required")
		return
	}
	if err := h.svc.BatchAbandon(userID, req.IDs); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) BatchToggle(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req BatchIDsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.IDs) == 0 {
		response.Error(c, http.StatusBadRequest, "ids required")
		return
	}
	if err := h.svc.BatchToggle(userID, req.IDs); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) BatchRestore(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req BatchIDsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.IDs) == 0 {
		response.Error(c, http.StatusBadRequest, "ids required")
		return
	}
	if err := h.svc.BatchRestore(userID, req.IDs); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) BatchMove(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req BatchMoveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.IDs) == 0 {
		response.Error(c, http.StatusBadRequest, "ids required")
		return
	}
	if err := h.svc.BatchMove(userID, req.IDs, req.ListID); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}
```

**Step 2: 验证编译**

```bash
cd topi-api && go build ./...
```

Expected: 成功

**Step 3: Commit**

```bash
git add topi-api/internal/handler/task_handler.go
git commit -m "feat(handler): add batch task endpoints"
```

---

## Task 3: 后端路由注册（batch 必须在 :id 之前）

**Files:**
- Modify: `topi-api/internal/wire/wire.go`
- Modify: `topi-api/internal/wire/wire_gen.go`（若 wire 自动生成则需运行 wire）

**Step 1: 在 wire.go 的 auth 块中，在 `auth.PATCH("/tasks/:id", ...)` 之前添加 batch 路由**

定位到：

```go
auth.PATCH("/tasks/:id", taskH.Update)
```

在其前一行（`auth.POST("/tasks/reorder", ...)` 之后）添加：

```go
auth.POST("/tasks/batch/trash", taskH.BatchTrash)
auth.POST("/tasks/batch/abandon", taskH.BatchAbandon)
auth.POST("/tasks/batch/toggle", taskH.BatchToggle)
auth.POST("/tasks/batch/restore", taskH.BatchRestore)
auth.POST("/tasks/batch/move", taskH.BatchMove)
```

**Step 2: 运行 wire 并验证**

```bash
cd topi-api && go generate ./internal/wire/... && go build ./...
```

Expected: 成功

**Step 3: Commit**

```bash
git add topi-api/internal/wire/
git commit -m "feat(api): register batch task routes"
```

---

## Task 4: 前端 useTasks 增加批量 API 调用

**Files:**
- Modify: `topi/app/hooks/use-tasks.ts`

**Step 1: 在 useTasks 返回值中增加 batchTrash、batchAbandon、batchToggle、batchRestore、batchMove**

在 `abandonTask` 的 `useCallback` 之后添加（需拿到 `invalidate` 或 `queryClient`）：

```ts
const batchTrash = useCallback(
  async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      await apiClient.post("/tasks/batch/trash", { ids });
      invalidate();
    } catch (e) {
      console.error("Batch trash failed:", e);
      throw e;
    }
  },
  [invalidate]
);

const batchAbandon = useCallback(
  async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      await apiClient.post("/tasks/batch/abandon", { ids });
      invalidate();
    } catch (e) {
      console.error("Batch abandon failed:", e);
      throw e;
    }
  },
  [invalidate]
);

const batchToggle = useCallback(
  async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      await apiClient.post("/tasks/batch/toggle", { ids });
      invalidate();
    } catch (e) {
      console.error("Batch toggle failed:", e);
      throw e;
    }
  },
  [invalidate]
);

const batchRestore = useCallback(
  async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      await apiClient.post("/tasks/batch/restore", { ids });
      invalidate();
    } catch (e) {
      console.error("Batch restore failed:", e);
      throw e;
    }
  },
  [invalidate]
);

const batchMove = useCallback(
  async (ids: string[], listId: string | null) => {
    if (ids.length === 0) return;
    try {
      await apiClient.post("/tasks/batch/move", { ids, listId });
      invalidate();
    } catch (e) {
      console.error("Batch move failed:", e);
      throw e;
    }
  },
  [invalidate]
);
```

**Step 2: 在 return 对象中导出以上方法**

在 `abandonTask,` 之后添加：

```ts
batchTrash,
batchAbandon,
batchToggle,
batchRestore,
batchMove,
```

**Step 3: 更新 TasksSource 接口（若 tasksSource 由父组件传入）**

在 `task-list.tsx` 或 `use-tasks.ts` 中，`TasksSource` 类型需包含上述 batch 方法。在 `task-list.tsx` 的 `TasksSource` 接口中添加（若存在该接口）。

**Step 4: 验证类型**

```bash
cd topi && pnpm exec tsc --noEmit
```

Expected: 无类型错误

**Step 5: Commit**

```bash
git add topi/app/hooks/use-tasks.ts
git commit -m "feat(hooks): add batch task API calls"
```

---

## Task 5: TaskList 增加批量模式状态与「批量操作」按钮

**Files:**
- Modify: `topi/app/components/task-list.tsx`

**Step 1: 增加 state**

在 `TaskList` 内，在 `deleteConfirmTaskId` 附近添加：

```ts
const [isBatchMode, setIsBatchMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
```

**Step 2: 添加「批量操作」按钮**

在 header 的 `flex items-center gap-2` 区域（与 showSort、clearTrash 同排），当 `mode !== "trash"` 时显示：

```tsx
{mode !== "trash" && (
  <Button
    variant={isBatchMode ? "default" : "outline"}
    size="sm"
    onClick={() => {
      setIsBatchMode((v) => !v);
      if (isBatchMode) setSelectedIds(new Set());
    }}
    aria-pressed={isBatchMode}
  >
    批量操作
  </Button>
)}
```

**Step 3: 进入批量模式时，禁用 DnD**

在 `DndContext` 的 `onDragEnd` 或 `mode === "default"` 条件中，增加 `!isBatchMode` 判断：批量模式下不渲染 `DndContext`，仅渲染普通列表。

**Step 4: Commit**

```bash
git add topi/app/components/task-list.tsx
git commit -m "feat(task-list): add batch mode state and toggle button"
```

---

## Task 6: 任务行增加选择 checkbox 与批量操作工具栏

**Files:**
- Modify: `topi/app/components/task-list.tsx`

**Step 1: 将 selectedIds、isBatchMode、batch 方法传递给 SortableTaskRow / renderTaskItem**

在 `SortableTaskRow` 和 `renderTaskItem` 的调用处，传入：
- `isBatchMode`
- `isSelected`（或 `selectedIds.has(task.id)`）
- `onToggleSelect`：`(id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })`

**Step 2: 在任务行左侧渲染选择 checkbox**

当 `isBatchMode` 为 true 时，在完成 checkbox 左侧（或整行最左侧）渲染一个 `Checkbox`，`checked={selectedIds.has(task.id)}`，`onCheckedChange` 调用 `onToggleSelect(task.id)`。与完成 checkbox 区分：完成 checkbox 控制 `task.completed`，选择 checkbox 控制 `selectedIds`。

**Step 3: 在 header 区域渲染批量操作工具栏**

当 `isBatchMode && selectedIds.size > 0` 时，在「批量操作」按钮旁或下方显示操作按钮组：
- 按 mode 显示：default → 删除、放弃、完成、移入清单；completed → 删除、放弃、移入清单；abandoned → 删除、恢复、完成、移入清单
- 删除/放弃：打开 DeleteConfirmDialog，文案「将 n 个任务移至垃圾桶？」等，onConfirm 调用 batchTrash
- 完成/取消完成：调用 batchToggle
- 恢复：调用 batchRestore
- 移入清单：DropdownMenu，首项「收集箱」，下列 `lists.map`，点击后 batchMove(ids, listId ?? null)

**Step 4: 删除/放弃的确认弹窗**

复用 `DeleteConfirmDialog`。需要新增状态 `batchDeleteConfirmOpen` 和 `batchAbandonConfirmOpen`，或共用一个「批量操作确认」state（type: "trash" | "abandon" | null）。

**Step 5: 成功后 toast 并清空选中**

各 batch 操作成功后：`toast.success("已删除 n 个任务")` 等；`setSelectedIds(new Set())`；`invalidate` 已由 hook 内部调用。

**Step 6: Commit**

```bash
git add topi/app/components/task-list.tsx
git commit -m "feat(task-list): selection checkbox and batch action toolbar"
```

---

## Task 7: 处理「已完成」区块的多选

**Files:**
- Modify: `topi/app/components/task-list.tsx`

**Step 1: 已完成区块内的任务也支持多选**

当 `mode === "default"` 且 `completedExpanded` 时，`completedTasks.map` 渲染的每行同样传入 `isBatchMode`、`isSelected`、`onToggleSelect`，并渲染选择 checkbox。

**Step 2: 确保 selectedIds 与 completedTasks 一致**

`selectedIds` 为 Set，同时包含 active 和 completed 任务 id 即可，无需额外逻辑。

**Step 3: Commit**

```bash
git add topi/app/components/task-list.tsx
git commit -m "feat(task-list): batch select for completed tasks"
```

---

## Task 8: 端到端验证

**Step 1: 启动 API 与前端**

```bash
# Terminal 1
cd topi-api && go run ./cmd/api

# Terminal 2
cd topi && pnpm dev
```

**Step 2: 手动验证**

1. 登录，进入任意任务页（非垃圾桶）
2. 点击「批量操作」，确认进入多选模式、每行左侧出现选择 checkbox
3. 选中 2–3 个任务，确认工具栏显示对应操作
4. 执行：删除 → 确认 → toast → 列表刷新
5. 执行：完成、放弃、移入清单（含收集箱）
6. 在已完成、已放弃页分别验证对应操作集合
7. 再次点击「批量操作」退出，确认选中清空

**Step 3: Commit（若有文档或小改动）**

```bash
git add docs/plans/2026-03-06-batch-tasks-design.md docs/plans/2026-03-06-batch-tasks-implementation.md
git commit -m "docs: batch tasks design and implementation plan"
```
