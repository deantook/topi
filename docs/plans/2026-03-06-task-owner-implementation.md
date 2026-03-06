# Task Owner Field Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为任务增加 `owner`（归属者）字段，取值 `human` | `agent` | `null`，支持筛选、展示与修改。

**Architecture:** 后端：Task 模型新增 Owner 字段，GORM AutoMigrate 自动迁移；Service/Handler/MCP 支持 owner 的创建、更新、列表筛选；响应含 owner。前端：Task 类型、API 映射、addTask/updateTask 传 owner；筛选 UI（全部|我|Agent）；任务行与详情面板展示 owner 图标/切换。

**Tech Stack:** Go, Gin, GORM, React, TanStack Query

---

参考设计：`docs/plans/2026-03-06-task-owner-design.md`

---

### Task 1: 模型与数据库迁移

**Files:**
- Modify: `topi-api/internal/model/task.go`
- Create: `topi-api/docs/migrations/add_tasks_owner.sql`

**Step 1: 添加 TaskOwner 枚举和 Owner 字段**

在 `topi-api/internal/model/task.go` 中，在 `TaskPriority` 常量后添加：

```go
type TaskOwner string

const (
	TaskOwnerHuman TaskOwner = "human"
	TaskOwnerAgent TaskOwner = "agent"
)
```

在 `Task` 结构体中添加（放在 `Status` 之后）：

```go
Owner *TaskOwner `gorm:"size:6" json:"owner,omitempty"`
```

**Step 2: 创建迁移 SQL（供手动执行）**

Create `topi-api/docs/migrations/add_tasks_owner.sql`:

```sql
-- Add owner column to tasks table (human | agent | null)
-- GORM AutoMigrate adds this automatically on server start.
-- For manual execution (e.g., pre-production scripts):
ALTER TABLE tasks ADD COLUMN owner VARCHAR(8) DEFAULT NULL;
```

**Step 3: 验证 build**

```bash
cd topi-api && go build ./...
```

**Step 4: Commit**

```bash
git add topi-api/internal/model/task.go topi-api/docs/migrations/add_tasks_owner.sql
git commit -m "feat(model): add TaskOwner enum and Owner field to Task"
```

---

### Task 2: Repository 支持 owner 筛选

**Files:**
- Modify: `topi-api/internal/repository/task_repo.go`

**Step 1: 修改 ListByUserID 签名**

将 `ListByUserID(userID string, filter string, listID *string)` 改为 `ListByUserID(userID string, filter string, listID *string, owner *string)`。

在 switch filter 的各个 case 中，在最终 `q` 上添加 owner 过滤逻辑（在 `q.Order("sort_order")` 之前）：

```go
if owner != nil && *owner != "" && *owner != "all" {
	if *owner == "human" {
		q = q.Where("owner = ?", model.TaskOwnerHuman)
	} else if *owner == "agent" {
		q = q.Where("owner = ?", model.TaskOwnerAgent)
	}
}
```

**Step 2: 更新 ListByUserID 的所有调用处**

在 `topi-api` 中搜索 `ListByUserID`，对每个调用添加第四个参数 `nil`（后续 Task 会在 Service 层传入真实值）。

**Step 3: 验证 build**

```bash
cd topi-api && go build ./...
```

**Step 4: Commit**

```bash
git add topi-api/internal/repository/task_repo.go topi-api/internal/service/task_service.go
git commit -m "feat(repo): add owner filter to ListByUserID"
```

---

### Task 3: Service 层支持 owner

**Files:**
- Modify: `topi-api/internal/service/task_service.go`

**Step 1: Create 方法增加 owner 参数**

`Create` 签名改为：`Create(userID string, title string, listID *string, dueDate *string, priority *string, detail *string, owner *model.TaskOwner, loc *time.Location)`

在构造 `model.Task` 时添加 `Owner: owner`。调用方（Handler）根据来源传入 `model.TaskOwnerHuman` 或 nil（默认 human）。

**Step 2: BatchCreate 增加 owner**

`BatchTaskInput` 增加 `Owner *string` 字段。`BatchCreate` 签名增加 `defaultOwner *model.TaskOwner`（当每项 Owner 为 nil 时使用）。在 validatedTask 和创建 model.Task 时：若 `inp.Owner == "human"` 则 `Owner = TaskOwnerHuman`，若 `inp.Owner == "agent"` 则 `TaskOwnerAgent`，否则用 `defaultOwner`。

**Step 3: Update 方法增加 owner 参数**

`Update` 签名增加 `owner *string`。在 `fields` 中添加：

```go
if owner != nil {
	switch *owner {
	case "human":
		fields["owner"] = model.TaskOwnerHuman
	case "agent":
		fields["owner"] = model.TaskOwnerAgent
	default:
		return errors.New("owner must be 'human' or 'agent'")
	}
}
```

**Step 4: List 方法增加 owner 参数并传递给 Repository**

`List` 签名增加 `owner string`。调用 `s.repo.ListByUserID(userID, filter, listID, &owner)`（当 owner 为空或 "all" 时传 nil）。

**Step 5: 验证 build**

```bash
cd topi-api && go build ./...
```

**Step 6: Commit**

```bash
git add topi-api/internal/service/task_service.go
git commit -m "feat(service): add owner to Create, BatchCreate, Update, List"
```

---

### Task 4: HTTP Handler 支持 owner

**Files:**
- Modify: `topi-api/internal/handler/task_handler.go`

**Step 1: formatTaskForResponse 添加 owner**

在 `formatTaskForResponse` 的 `m` map 中添加：`m["owner"] = t.Owner`（若 t.Owner 为 nil 则 `m["owner"] = nil`）。

**Step 2: CreateTaskReq 和 CreateTasksBatchReq 的 Tasks 项增加 Owner**

在 `CreateTaskReq` 增加 `Owner *string`。`Create(c)`：若 `req.Owner` 为 "agent" 则传 `&model.TaskOwnerAgent`，否则传 `&model.TaskOwnerHuman`。`CreateBatch(c)`：将 `BatchTaskInput.Owner` 从每项 `CreateTaskReq` 传入，调用 `BatchCreate(..., &model.TaskOwnerHuman, loc)` 作为 defaultOwner。

**Step 3: List 读取 owner 参数**

`List(c)` 中：`owner := c.DefaultQuery("owner", "all")`，传给 `h.svc.List(..., owner)`。

**Step 4: UpdateTaskReq 增加 Owner，Update 传入**

`UpdateTaskReq` 增加 `Owner *string`，`Update(c)` 中若 `req.Owner != nil` 则传给 `h.svc.Update(..., req.Owner, ...)`。

**Step 5: 验证 build**

```bash
cd topi-api && go build ./...
```

**Step 6: Commit**

```bash
git add topi-api/internal/handler/task_handler.go
git commit -m "feat(api): add owner to create, list, update endpoints"
```

---

### Task 5: MCP 支持 owner

**Files:**
- Modify: `topi-api/internal/mcp/handlers/task_handlers.go`

**Step 1: CreateTask 支持 owner**

从 `req.GetString("owner", "")` 取值。若为 "human" 则传 `model.TaskOwnerHuman`，若为 "agent" 或空则传 `model.TaskOwnerAgent`（MCP 默认 agent）。调用 `TaskSvc.Create(..., owner, ...)`。

**Step 2: CreateTasks 批量创建支持 owner**

在解析每项 `m` 时：若 `m["owner"] == "human"` 则 `inp.Owner = ptr("human")`，否则 `inp.Owner = nil`（表示 agent）。调用 `TaskSvc.BatchCreate(userID, inputs, &model.TaskOwnerAgent, loc)`，即 defaultOwner=agent。

**Step 3: UpdateTask 支持 owner**

从 `args["owner"]` 判断是否传入，若有则 `req.GetString("owner", "")` 传给 `TaskSvc.Update` 的 owner 参数。

**Step 4: ListTasks 支持 owner 参数并返回 owner**

`filter := req.GetString("filter", "all")` 下增加 `owner := req.GetString("owner", "all")`。调用 List 时传入 owner。返回的每项 `out` 增加 `"owner": t.Owner`。

**Step 5: 验证 build**

```bash
cd topi-api && go build ./...
```

**Step 6: Commit**

```bash
git add topi-api/internal/mcp/handlers/task_handlers.go
git commit -m "feat(mcp): add owner to create, update, list"
```

---

### Task 6: 前端 Task 类型与 API 映射

**Files:**
- Modify: `topi/app/hooks/use-tasks.ts`

**Step 1: Task 接口和 ApiTask 增加 owner**

`Task` 增加 `owner: "human" | "agent" | null`。`ApiTask` 增加 `owner?: string | null`。

**Step 2: mapTask 映射 owner**

```ts
const rawOwner = r.owner;
const owner: "human" | "agent" | null =
  rawOwner === "human" || rawOwner === "agent" ? rawOwner : null;
return { ...existing, owner };
```

**Step 3: filterToQuery 增加 owner 参数**

`filterToQuery` 增加第二个参数 `owner?: string`，若 `owner` 为 "human" 或 "agent" 则 `params.owner = owner`。

**Step 4: useTasks 增加 options.owner**

`useTasks(filter, options?: { owner?: string })`。`filterToQuery` 传入 `options?.owner`。`queryFn` 中 `params` 合并 owner。

**Step 5: addTask 传 owner: "human"**

在 `body` 中设置 `owner: "human"`（Web 创建默认 human）。

**Step 6: updateTask 支持 owner**

在 `updates` 的 `Partial<Pick<...>>` 中加入 `owner`。若 `updates.owner !== undefined` 则 `body.owner = updates.owner`。

**Step 7: Commit**

```bash
git add topi/app/hooks/use-tasks.ts
git commit -m "feat(web): add owner to Task type and API integration"
```

---

### Task 7: 前端常量与 owner 展示

**Files:**
- Modify: `topi/app/lib/task-constants.ts`
- Modify: `topi/app/components/task-list.tsx`

**Step 1: 添加 OWNER_LABEL**

在 `task-constants.ts` 添加：

```ts
export type TaskOwner = "human" | "agent" | null;

export const OWNER_LABEL: Record<NonNullable<TaskOwner>, string> = {
  human: "我",
  agent: "Agent",
};
```

**Step 2: 任务行显示 owner 图标**

在 `task-list.tsx` 的 SortableTaskRow 中，在 `showListName` 的 span 之后、DateTimePickerPopover 之前，添加 owner 小图标：若 `task.owner === "human"` 显示 `User` 图标，若 `task.owner === "agent"` 显示 `Bot` 或 `Sparkles`，`null` 不显示。使用 `lucide-react` 的 `User`、`Bot`。

**Step 3: Commit**

```bash
git add topi/app/lib/task-constants.ts topi/app/components/task-list.tsx
git commit -m "feat(web): add owner label and display icon in task row"
```

---

### Task 8: 筛选 UI 与 URL 同步

**Files:**
- Modify: `topi/app/components/task-page-with-detail.tsx`
- Modify: `topi/app/components/task-list.tsx`（如需筛选器放在列表内则改 TaskList）
- Modify: 各路由页面（today, tomorrow, inbox, all, recent-seven, list.$listId）传入 owner

**Step 1: 筛选器组件**

在 `task-page-with-detail.tsx` 的标题行（或 `task-list.tsx` 的 header）添加三个按钮/链接：全部 | 我 | Agent。使用 `useSearchParams`，点击时 `setSearchParams({ owner: "human" })` 等，`owner=all` 或不传表示全部。

**Step 2: 将 owner 传给 useTasks**

`TaskPageWithDetail` 中：`owner = searchParams.get("owner") ?? "all"`。`useTasks(filter, { owner })`。

**Step 3: 确保 TaskList 使用共享的 tasksSource**

已支持。确认 `useTasks(filter, { owner })` 被正确传入，`TaskList` 的 `tasksSource` 使用该 hook。

**Step 4: Commit**

```bash
git add topi/app/components/task-page-with-detail.tsx topi/app/components/task-list.tsx topi/app/routes/*.tsx
git commit -m "feat(web): add owner filter UI and URL sync"
```

---

### Task 9: 详情面板显示与切换 owner

**Files:**
- Modify: `topi/app/components/task-detail-panel.tsx` 或 `task-detail-editor.tsx`

**Step 1: 详情面板显示 owner**

在任务标题下方显示当前归属者：图标 + `OWNER_LABEL[task.owner]` 或「未知」（当 null）。

**Step 2: 添加切换控件**

使用 `Select` 或 `RadioGroup`：选项「我」「Agent」。`onValueChange` 时调用 `updateTask(task.id, { owner: value })`。需要从 `TaskPageWithDetail` 传入 `updateTask`，已有 `onSaveDetail`，可增加 `onUpdateOwner` 或复用 `updateTask`。

**Step 3: Commit**

```bash
git add topi/app/components/task-detail-panel.tsx
git commit -m "feat(web): show and edit owner in task detail panel"
```

---

### Task 10: Dashboard 与兼容性检查

**Files:**
- Modify: `topi-api/internal/handler/`（若 dashboard 返回 task 需含 owner）
- Review: 确保已完成、已放弃、垃圾桶等视图也支持 owner 筛选（可选）

**Step 1: 检查 dashboard API**

若 dashboard 返回任务列表，确保含 `owner`。若只返回 count，通常不需要改。

**Step 2: 手动测试**

- 创建任务（Web、MCP），检查 owner
- 筛选 全部/我/Agent
- 在详情中切换 owner
- 旧任务（owner=null）在「全部」中显示，在「我」「Agent」中不显示

**Step 3: Commit（若有改动）**

```bash
git add ...
git commit -m "chore: dashboard/owner compatibility"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-06-task-owner-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
