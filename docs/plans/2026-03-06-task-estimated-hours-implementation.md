# Task Estimated Hours Implementation Plan

> **For Claude:** 按任务顺序实现，每步完成后验证 build 再提交。

**Goal:** 为任务增加预估耗时字段 `estimated_hours`（整数小时），供用户与 Agent 使用；Agent Skill 需明确指引「根据 estimated_hours 安排 dueDate」。

**Architecture:** Model 新增 EstimatedHours、Migration、Service 层 Create/BatchCreate/Update 支持、REST/MCP 透传、Agent Skill 更新（含安排截止时间指引）。

**Tech Stack:** Go, Gin, GORM, mcp-go

---

参考设计：`docs/plans/2026-03-06-task-estimated-hours-design.md`

---

### Task 1: 模型与数据库迁移

**Files:**
- Modify: `topi-api/internal/model/task.go`
- Create: `topi-api/docs/migrations/add_tasks_estimated_hours.sql`

**Step 1: 在 Task 结构体中添加 EstimatedHours**

在 `Task` 结构体中（放在 `Owner` 之后）：

```go
EstimatedHours *int `gorm:"column:estimated_hours" json:"estimated_hours,omitempty"`
```

**Step 2: 创建迁移 SQL**

Create `topi-api/docs/migrations/add_tasks_estimated_hours.sql`:

```sql
-- Add estimated_hours column to tasks table (integer hours, nullable)
ALTER TABLE tasks ADD COLUMN estimated_hours INT DEFAULT NULL;
```

**Step 3: 验证 build**

```bash
cd topi-api && go build ./...
```

**Step 4: Commit**

```bash
git add topi-api/internal/model/task.go topi-api/docs/migrations/add_tasks_estimated_hours.sql
git commit -m "feat(model): add EstimatedHours field to Task"
```

---

### Task 2: TaskService 层支持 estimated_hours

**Files:**
- Modify: `topi-api/internal/service/task_service.go`

**Step 1: 添加 validateEstimatedHours 辅助函数**

```go
// validateEstimatedHours returns (value, nil) if valid positive int, or (nil, error) if invalid.
func validateEstimatedHours(v interface{}) (*int, error) {
	if v == nil {
		return nil, nil
	}
	switch x := v.(type) {
	case float64:
		i := int(x)
		if float64(i) != x || i < 1 {
			return nil, errors.New("estimated_hours 需为正整数")
		}
		return &i, nil
	case int:
		if x < 1 {
			return nil, errors.New("estimated_hours 需为正整数")
		}
		return &x, nil
	default:
		return nil, errors.New("estimated_hours 需为正整数")
	}
}
```

**Step 2: 修改 Create 签名和实现**

- 签名增加 `estimatedHours *int`
- 若 estimatedHours != nil 且 < 1，返回错误
- 在构造 `model.Task` 时设置 `EstimatedHours: estimatedHours`

**Step 3: 修改 BatchTaskInput 和 BatchCreate**

- `BatchTaskInput` 增加 `EstimatedHours *int`（从 JSON 解析时可能为 float64，需 convert）
- 在 validatedTask 中增加 estimatedHours
- 校验：若传入则需 ≥ 1，否则 `task[i].estimatedHours: invalid`
- 在创建时设置 `EstimatedHours`

**Step 4: 修改 Update**

- 签名增加 `estimatedHours *int`
- 若 estimatedHours != nil：若 < 1 返回错误；若为 0 或清空，可设 fields["estimated_hours"] = nil；否则设具体值
- 支持传 nil 表示不修改、传 pointer 表示更新（包括清空）

**Step 5: 验证 build**

```bash
cd topi-api && go build ./...
```

**Step 6: Commit**

```bash
git add topi-api/internal/service/task_service.go
git commit -m "feat(service): support estimated_hours in Create, BatchCreate, Update"
```

---

### Task 3: REST Handler 与 API

**Files:**
- Modify: `topi-api/internal/handler/task_handler.go`

**Step 1: CreateTaskReq 和 formatTaskForResponse**

- `CreateTaskReq` 增加 `EstimatedHours *int`
- `formatTaskForResponse` 增加 `"estimated_hours": t.EstimatedHours`

**Step 2: Create / CreateBatch / Update**

- Create: 将 `req.EstimatedHours` 传给 `svc.Create`（新增参数）
- CreateBatch: `BatchTaskInput` 从 `req.Tasks[i].EstimatedHours` 传入
- Update: 解析 PATCH 体中的 `estimated_hours`，传给 `svc.Update`

**Step 3: Service 调用处修改**

- 所有 `TaskService.Create` 调用增加 estimatedHours 参数
- `TaskService.Update` 调用增加 estimatedHours 参数

**Step 4: 验证 build**

```bash
cd topi-api && go build ./...
```

**Step 5: Commit**

```bash
git add topi-api/internal/handler/task_handler.go
git commit -m "feat(api): REST support estimated_hours for tasks"
```

---

### Task 4: MCP Handler 与工具注册

**Files:**
- Modify: `topi-api/internal/mcp/handlers/task_handlers.go`
- Modify: `topi-api/internal/mcpsetup/server.go`

**Step 1: ListTasks 返回 estimated_hours**

在 `out` map 中添加 `"estimated_hours": t.EstimatedHours`

**Step 2: CreateTask**

- 从 `req.GetString("estimatedHours", "")` 或 `req.Get("estimatedHours")` 获取
- MCP 可能传 number，需兼容：若为空或未传则 nil；否则 parse 为正整数
- 调用 `TaskSvc.Create` 时传入 `estimatedHours`

**Step 3: CreateTasks (BatchCreate)**

- 遍历 parsed 时，若 `m["estimatedHours"]` 存在，转为 `*int`（JSON number 为 float64）
- 调用 `validateEstimatedHours` 或内联校验
- 填充 `BatchTaskInput.EstimatedHours`

**Step 4: UpdateTask**

- 从 args 检查 `estimatedHours`，若存在则解析并传入 `TaskSvc.Update`

**Step 5: mcpsetup/server.go 注册参数**

- `topi_create_task`: `mcp.WithString("estimatedHours", mcp.Description("Optional estimated hours (positive integer)"))`
- `topi_create_tasks`: 在 description 中说明 tasks 每项可含 `estimatedHours?`
- `topi_update_task`: `mcp.WithString("estimatedHours", mcp.Description("New estimated hours (positive integer)"))`

**Step 6: 修改 TaskService.Create/Update 的 wire 及 handler 调用**

- Handler 需能从 MCP 的 string "2" 解析出 *int；若传空则不设置

**Step 7: 验证 build**

```bash
cd topi-api && go build ./...
```

**Step 8: Commit**

```bash
git add topi-api/internal/mcp/handlers/task_handlers.go topi-api/internal/mcpsetup/server.go
git commit -m "feat(mcp): add estimatedHours to create/update/list task tools"
```

---

### Task 5: Agent Skill 更新

**Files:**
- Modify: `.cursor/skills/topi-mcp-tasks/SKILL.md`
- Modify: `.cursor/skills/topi-mcp-tasks/reference.md`

**Step 1: SKILL.md 更新**

- 使用场景表「添加」「更新」行增加：可传 `estimatedHours`（预估耗时，整数小时）
- 核心工作流「创建任务」：补充「若用户给出预估耗时，传入 `estimatedHours`；Agent 可结合此字段为用户安排合理的 `dueDate`」
- **新增小节「预估耗时与安排截止时间」**：

```markdown
## 预估耗时 (estimatedHours)

任务可设置预估耗时（整数小时），用于时间规划。

**规则：**
- 创建/更新任务时，可选传入 `estimatedHours`（正整数）
- 当用户添加任务并附带预估耗时，或 Agent 能从描述推断耗时，应传入此字段
- **安排截止时间：** Agent 应根据 `estimatedHours` 为任务设置合理的 `dueDate`。例如用户说「把这三件事记下来，各 2 小时、1 小时、3 小时」，创建时传入 `estimatedHours`，并可基于当前时间或用户指定起始时间，按累计耗时自动分配 `dueDate`
```

**Step 2: reference.md 更新**

- 任务工具参数表：
  - `topi_create_task` 可选参数增加 `estimatedHours`
  - `topi_create_tasks` 每项增加 `estimatedHours?`
  - `topi_update_task` 可选参数增加 `estimatedHours`
- 新增说明：`estimatedHours`：整数小时，≥1，可选。用于时间规划；Agent 可根据此安排 `dueDate`。

**Step 3: Commit**

```bash
git add .cursor/skills/topi-mcp-tasks/SKILL.md .cursor/skills/topi-mcp-tasks/reference.md
git commit -m "docs(skill): add estimatedHours and dueDate arrangement guidance"
```

---

### Task 6: 文档同步

**Files:**
- Modify: `topi-api/docs/MCP.md`

**Step 1: 任务工具参数表**

- `topi_create_task`、`topi_create_tasks`、`topi_update_task` 增加 `estimatedHours`（可选，整数小时）

**Step 2: Commit**

```bash
git add topi-api/docs/MCP.md
git commit -m "docs(mcp): add estimatedHours to task tool params"
```

---

## 验证清单

- [ ] Model 含 EstimatedHours， migration 可执行
- [ ] REST Create/Batch/Update 支持 estimated_hours，响应含该字段
- [ ] MCP topi_create_task、topi_create_tasks、topi_update_task 支持 estimatedHours
- [ ] topi_list_tasks 返回含 estimated_hours
- [ ] 传入 0、负数、小数时返回明确错误
- [ ] Agent Skill 含「根据 estimatedHours 安排 dueDate」指引
