# Task Batch Create Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 新增任务批量创建能力，支持 HTTP API 与 MCP，供 AI 一次性创建多条任务。

**Architecture:** 在 TaskService 增加 BatchCreate，使用事务保证全成功或全失败；TaskRepository 增加 RunInTransaction 与 CreateWithTx 支持事务内创建；TaskHandler 增加 CreateBatch；MCP 增加 topi_create_tasks 工具。

**Tech Stack:** Go, Gin, GORM, mcp-go

---

参考设计：`docs/plans/2026-03-05-task-batch-create-design.md`

---

### Task 1: Repository 支持事务内创建

**Files:**
- Modify: `topi-api/internal/repository/task_repo.go`

**Step 1: 添加 RunInTransaction、CreateWithTx、GetMaxOrderWithTx**

```go
// RunInTransaction runs fn inside a transaction. If fn returns error, transaction is rolled back.
func (r *TaskRepository) RunInTransaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}

// CreateWithTx creates a task using the given transaction.
func (r *TaskRepository) CreateWithTx(tx *gorm.DB, t *model.Task) error {
	return tx.Create(t).Error
}

// GetMaxOrderWithTx returns the max sort_order for userID, or 0 if none. Used inside transaction.
func (r *TaskRepository) GetMaxOrderWithTx(tx *gorm.DB, userID string) (int, error) {
	var maxOrder int
	err := tx.Model(&model.Task{}).Where("user_id = ?", userID).Select("COALESCE(MAX(sort_order), -1)").Scan(&maxOrder).Error
	if err != nil {
		return 0, err
	}
	return maxOrder + 1, nil // return next available order
}
```

**Step 2: 运行 build**

```bash
cd topi-api && go build ./...
```

**Step 3: Commit**

```bash
git add topi-api/internal/repository/task_repo.go
git commit -m "feat(repo): add RunInTransaction and CreateWithTx for batch create"
```

---

### Task 2: TaskService.BatchCreate

**Files:**
- Modify: `topi-api/internal/service/task_service.go`

**Step 1: 定义 BatchTaskInput**

```go
type BatchTaskInput struct {
	Title    string
	ListID   *string
	DueDate  *string
	Priority *string
}
```

**Step 2: 实现 BatchCreate**

- 若 len(tasks)==0 返回 error "at least one task required"
- 先校验每项：title 非空；若 dueDate 非空则 parse；若 priority 非空则校验取值
- 任一项失败则返回带下标错误，如 "task[2].dueDate: invalid format"
- 通过后：在 RunInTransaction 中调用 GetMaxOrderWithTx 取起始 order，循环创建，order 递增
- 复用 normalizeDateTimeString、parseLocalToUTC、priority 逻辑（与 Create 一致）

**Step 3: 运行 build**

```bash
cd topi-api && go build ./...
```

**Step 4: Commit**

```bash
git add topi-api/internal/service/task_service.go
git commit -m "feat(service): add BatchCreate for tasks"
```

---

### Task 3: HTTP Handler CreateBatch

**Files:**
- Modify: `topi-api/internal/handler/task_handler.go`
- Modify: `topi-api/internal/wire/wire.go`（路由）

**Step 1: 添加 CreateBatch**

- `CreateTasksBatchReq struct { Tasks []CreateTaskReq }`
- `CreateBatch(c *gin.Context)`：绑定 JSON，校验 len(req.Tasks)>0，转换[]BatchTaskInput，调用 svc.BatchCreate，用 formatTaskForResponse 格式化返回 response.OK(c, out)

**Step 2: 注册路由**

在 `provideRouter` 的 auth 组中，在 `POST /tasks/reorder` 之前添加：

```go
auth.POST("/tasks/batch", taskH.CreateBatch)
```

**Step 3: 运行 build**

```bash
cd topi-api && go build ./...
```

**Step 4: Commit**

```bash
git add topi-api/internal/handler/task_handler.go topi-api/internal/wire/wire.go
git commit -m "feat(api): add POST /tasks/batch endpoint"
```

---

### Task 4: MCP topi_create_tasks

**Files:**
- Modify: `topi-api/internal/mcp/handlers/task_handlers.go`
- Modify: `topi-api/internal/mcpsetup/server.go`

**Step 1: 实现 CreateTasks handler**

- 从 req 取 tasks（数组）。mcp-go 可用 `req.GetArray("tasks")` 或 `req.Get("tasks")` 配合类型断言
- 若为空或非数组，返回 NewToolResultError
- 遍历构造 []service.BatchTaskInput，调用 TaskSvc.BatchCreate
- 返回 JSON 数组或错误

**Step 2: 注册工具**

在 mcpsetup/server.go 中：

```go
s.AddTool(
	mcp.NewTool("topi_create_tasks",
		mcp.WithDescription("Create multiple tasks at once"),
		mcp.WithArray("tasks", mcp.Required(), mcp.Description("Array of {title, listId?, dueDate?, priority?}")),
	),
	taskH.CreateTasks,
)
```

根据 mcp-go 的 WithArray API 调整。若需每项为 object，可能用 WithObject 或 WithInputSchema。

**Step 3: 运行 build**

```bash
cd topi-api && go build ./...
```

**Step 4: Commit**

```bash
git add topi-api/internal/mcp/handlers/task_handlers.go topi-api/internal/mcpsetup/server.go
git commit -m "feat(mcp): add topi_create_tasks tool"
```

---

### Task 5: Swagger 注解（可选）

**Files:**
- Modify: `topi-api/internal/handler/task_handler.go`（或 docs 目录下的 swagger 注解）

**Step 1: 为 CreateBatch 添加 Swagger 注解**

按项目现有 swagger 风格，为 `POST /api/v1/tasks/batch` 添加注释。

**Step 2: 生成 Swagger**

```bash
cd topi-api && swag init -g cmd/server/main.go -o docs
```

**Step 3: Commit**

```bash
git add topi-api/internal/handler/ topi-api/docs/
git commit -m "docs(swagger): add tasks/batch endpoint"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-05-task-batch-create-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
