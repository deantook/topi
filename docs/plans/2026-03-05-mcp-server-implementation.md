# MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 topi-api 中内嵌 MCP SSE server，使 Cursor 能通过 MCP 工具操作 Topi 的待办和清单。

**Architecture:** 使用 mark3labs/mcp-go 创建 MCP server，通过 SSE transport 暴露；在建立连接时校验 JWT 并从 context 传递 userID；tool handlers 直接调用 TaskService/ListService。优先尝试将 mcp-go 的 SSE handler 挂载到 Gin；若不可行，则运行独立 HTTP 服务或使用 gin-mcp 等桥接库。

**Tech Stack:** Go 1.25, Gin, mark3labs/mcp-go, 现有 TaskService/ListService/JWT

---

参考设计：`docs/plans/2026-03-05-mcp-server-design.md`

---

### Task 1: 添加 mcp-go 依赖并验证 SSE 集成方式

**Files:**
- Modify: `topi-api/go.mod`
- Create: `topi-api/internal/mcp/README.md`（临时，记录 SSE 挂载结论）

**Step 1: 添加依赖**

```bash
cd topi-api && go get github.com/mark3labs/mcp-go
```

**Step 2: 验证能否获取 HTTP Handler**

查阅 mcp-go 文档与源码，确认：
- `server.NewSSEServer(s)` 是否暴露 `http.Handler` 或可挂载到已有 `*http.ServeMux`
- 若无，记录备选方案：gin-mcp、或 MCP 独立端口

在 `internal/mcp/README.md` 中写下结论（1–2 句）。

**Step 3: Commit**

```bash
git add topi-api/go.mod topi-api/go.sum topi-api/internal/mcp/README.md
git commit -m "chore: add mcp-go dependency"
```

---

### Task 2: 实现 MCP 认证中间件（提取 userID）

**Files:**
- Create: `topi-api/internal/mcp/auth.go`
- Create: `topi-api/internal/mcp/context.go`
- Test: `topi-api/internal/mcp/auth_test.go`

**Step 1: 定义 context key 与 helper**

在 `context.go` 中：

```go
package mcp

import "context"

type contextKey string

const UserIDContextKey contextKey = "user_id"

func UserIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(UserIDContextKey).(string)
	return v
}

func ContextWithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, UserIDContextKey, userID)
}
```

**Step 2: 写测试**

在 `auth_test.go` 中：

```go
package mcp

import (
	"context"
	"testing"
)

func TestUserIDFromContext(t *testing.T) {
	ctx := context.Background()
	if UserIDFromContext(ctx) != "" {
		t.Error("expected empty for missing userID")
	}
	ctx = ContextWithUserID(ctx, "user-123")
	if UserIDFromContext(ctx) != "user-123" {
		t.Error("expected user-123")
	}
}
```

**Step 3: 运行测试**

```bash
cd topi-api && go test ./internal/mcp/... -v
```

Expected: PASS

**Step 4: 实现 Auth 提取逻辑**

在 `auth.go` 中：

```go
package mcp

import (
	"context"
	"net/http"
	"strings"

	"github.com/deantook/topi-api/pkg/jwt"
)

func ExtractUserIDFromRequest(jwtHelper *jwt.Helper, r *http.Request) (string, error) {
	token := r.URL.Query().Get("token")
	if token == "" {
		if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
			token = strings.TrimPrefix(h, "Bearer ")
		}
	}
	if token == "" {
		return "", nil
	}
	claims, err := jwtHelper.Verify(token)
	if err != nil {
		return "", err
	}
	return claims.UserID, nil
}

func AuthMiddleware(jwtHelper *jwt.Helper) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, err := ExtractUserIDFromRequest(jwtHelper, r)
			if err != nil || userID == "" {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			ctx := ContextWithUserID(r.Context(), userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
```

（`jwt.Helper.Verify` 返回 `*jwt.Claims`，含 `UserID`。）

**Step 5: 运行测试**

```bash
cd topi-api && go test ./internal/mcp/... -v && go build ./...
```

Expected: PASS, build 成功

**Step 6: Commit**

```bash
git add topi-api/internal/mcp/
git commit -m "feat(mcp): add auth context and JWT extraction"
```

---

### Task 3: 实现任务 tool handlers（第一批）

**Files:**
- Create: `topi-api/internal/mcp/handlers/task_handlers.go`
- Modify: `topi-api/internal/mcp/auth.go`（若需从 context 注入 service）

**Step 1: 实现 topi_list_tasks 和 topi_create_task**

参考 `topi-api/internal/service/task_service.go` 的 `List`、`Create` 签名。handler 从 `mcp.CallToolRequest` 取参数，调用 service，返回 `mcp.NewToolResultText(...)` 或 `mcp.NewToolResultError(...)`。

```go
package handlers

import (
	"context"
	"encoding/json"
	"time"

	"github.com/deantook/topi-api/internal/mcp"
	"github.com/deantook/topi-api/internal/service"
	"github.com/mark3labs/mcp-go/mcp"
)

type TaskHandlers struct {
	TaskSvc *service.TaskService
}

func NewTaskHandlers(taskSvc *service.TaskService) *TaskHandlers {
	return &TaskHandlers{TaskSvc: taskSvc}
}

func (h *TaskHandlers) ListTasks(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := mcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	filter := req.GetString("filter", "all")
	listID := req.GetString("listId", "")
	var lp *string
	if listID != "" {
		lp = &listID
	}
	date := req.GetString("date", "")
	startDate := req.GetString("startDate", "")
	endDate := req.GetString("endDate", "")
	tasks, err := h.TaskSvc.List(userID, filter, lp, date, startDate, endDate, time.UTC)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	// 简化：将 tasks 序列化为 JSON 返回
	out := make([]map[string]interface{}, 0, len(tasks))
	for _, t := range tasks {
		out = append(out, map[string]interface{}{
			"id": t.ID, "title": t.Title, "completed": t.Completed,
			"due_date": t.DueDate, "priority": t.Priority, "status": t.Status,
		})
	}
	b, _ := json.Marshal(out)
	return mcp.NewToolResultText(string(b)), nil
}

func (h *TaskHandlers) CreateTask(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := mcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	title, err := req.RequireString("title")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	listID := req.GetString("listId", "")
	var lp *string
	if listID != "" {
		lp = &listID
	}
	dueDate := req.GetString("dueDate", "")
	var dp *string
	if dueDate != "" {
		dp = &dueDate
	}
	priority := req.GetString("priority", "none")
	task, err := h.TaskSvc.Create(userID, title, lp, dp, &priority, time.UTC)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	b, _ := json.Marshal(map[string]interface{}{"id": task.ID, "title": task.Title})
	return mcp.NewToolResultText(string(b)), nil
}
```

（`TaskService.Create` 接受 `loc *time.Location`，MCP 暂用 `time.UTC`；可后续从 `X-Timezone` header 解析。）

**Step 2: 运行 build**

```bash
cd topi-api && go build ./...
```

若编译失败，根据 `TaskService` 实际接口修正。

**Step 3: Commit**

```bash
git add topi-api/internal/mcp/handlers/
git commit -m "feat(mcp): add list_tasks and create_task handlers"
```

---

### Task 4: 实现剩余任务 tool handlers

**Files:**
- Modify: `topi-api/internal/mcp/handlers/task_handlers.go`

**Step 1: 实现 UpdateTask, ToggleTask, AbandonTask, RestoreTask, MoveToTrash（对应 service.MoveToTrash）, DeleteTask, ReorderTasks**

对照 `task_handler.go` 与 `task_service.go` 的接口，逐一对齐参数和返回值。每个 handler 从 `mcp.CallToolRequest` 取 `id` 等参数，调用对应 service 方法，返回 `mcp.NewToolResultText` 或 `mcp.NewToolResultError`。

**Step 2: 运行 build**

```bash
cd topi-api && go build ./...
```

**Step 3: Commit**

```bash
git add topi-api/internal/mcp/handlers/task_handlers.go
git commit -m "feat(mcp): add remaining task tool handlers"
```

---

### Task 5: 实现清单 tool handlers

**Files:**
- Create: `topi-api/internal/mcp/handlers/list_handlers.go`

**Step 1: 实现 topi_list_lists, topi_create_list, topi_update_list, topi_delete_list**

与 Task 4 类似，参数和逻辑对齐 `ListService`。

**Step 2: 运行 build**

```bash
cd topi-api && go build ./...
```

**Step 3: Commit**

```bash
git add topi-api/internal/mcp/handlers/list_handlers.go
git commit -m "feat(mcp): add list tool handlers"
```

---

### Task 6: 注册 MCP server 与 tools，挂载到 Gin

**Files:**
- Create: `topi-api/internal/mcp/server.go`
- Modify: `topi-api/internal/wire/wire.go`
- Modify: `topi-api/internal/wire/wire_gen.go`（若使用 wire generate）

**Step 1: 创建 MCP server 并注册 tools**

在 `server.go` 中创建 `NewMCPServer`，使用 `server.NewMCPServer`，注册全部 task 与 list tools。根据 Task 1 结论选择：

- 若 mcp-go 暴露 `http.Handler`：用 `gin.WrapH` 挂载到 `r.Any("/mcp/*path", ...)`
- 若支持自定义 base path：配置 base path 为 `/mcp`
- 若需独立服务：在 `main.go` 中 goroutine 启动 MCP 的 `ListenAndServe`

**Step 2: Wire 注入**

在 `wire.go` 中加入 MCP 相关 provider，注入 `TaskService`、`ListService`、`jwt.Helper`、`NewTaskHandlers`、`NewListHandlers`，并在 `provideRouter` 中挂载 MCP 路由。

**Step 3: 运行 wire 与 build**

```bash
cd topi-api && go generate ./internal/wire/... && go build ./...
```

**Step 4: 启动并手动验证**

```bash
make api
```

在另一终端用 MCP Inspector 或 curl 测试 `GET /mcp/sse?token=<valid_jwt>`（或实际路径），确认能建立连接并调用 `tools/list`、`tools/call`。

**Step 5: Commit**

```bash
git add topi-api/internal/mcp/ topi-api/internal/wire/
git commit -m "feat(mcp): wire MCP server and mount to Gin"
```

---

### Task 7: 集成 SSE 认证

**Files:**
- Modify: `topi-api/internal/mcp/server.go`（或 SSE 配置处）

**Step 1: 在 SSE 连接建立时校验 JWT**

使用 mcp-go 的 `WithSSEContextFunc` 或等价机制，在建立连接时从 request 提取 token，调用 `jwt.Helper.Parse`，将 `userID` 放入 context。若解析失败，不建立连接（返回 401 或关闭连接）。

**Step 2: 确保 tool handler 能拿到 userID**

确认 context 链正确传递，`mcp.UserIDFromContext(ctx)` 在 handler 内能拿到非空值。

**Step 3: 手动测试**

使用无效 token 连接，应被拒绝；使用有效 token，`topi_list_tasks` 应返回该用户的任务。

**Step 4: Commit**

```bash
git add topi-api/internal/mcp/
git commit -m "feat(mcp): enforce JWT auth on SSE connection"
```

---

### Task 8: 添加 .env.example 与文档

**Files:**
- Modify: `topi-api/.env.example`（若有 MCP 特定配置则添加）
- Modify: `docs/plans/2026-03-05-mcp-server-design.md` 或新建 `topi-api/docs/MCP.md`

**Step 1: 在文档中说明 Cursor 配置**

示例：

```markdown
## Cursor MCP 配置

在 Cursor Settings > Features > MCP 中添加：

- Transport: SSE
- URL: http://localhost:8080/mcp/sse?token=YOUR_JWT

获取 JWT：在 Topi 前端登录后，从浏览器 localStorage 的 `token` 键获取。
```

**Step 2: 删除临时 README**

若 `internal/mcp/README.md` 仅作调研笔记，可删除或合并到正式文档。

**Step 3: Commit**

```bash
git add topi-api/.env.example docs/ topi-api/internal/mcp/
git commit -m "docs: add MCP setup instructions"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-05-mcp-server-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
