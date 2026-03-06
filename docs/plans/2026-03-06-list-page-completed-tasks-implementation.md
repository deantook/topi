# List Page Completed Tasks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在每个清单页面显示可折叠的「已完成」区块，采用 `includeCompleted=true` 单次请求，后端一次返回 active + completed。

**Architecture:** 后端扩展 `/tasks` 支持 `includeCompleted` 参数，repo 层支持 completed 的子集查询（listId、inbox、date）；前端 useTasks 传入该参数并分组，TaskList 增加默认折叠的「已完成 (n)」区块。

**Tech Stack:** Go, Gin, GORM, React, TanStack Query

---

参考设计：`docs/plans/2026-03-06-list-page-completed-tasks-design.md`

---

### Task 1: 后端 Repo 层支持 completed 子集查询

**Files:**
- Modify: `topi-api/internal/repository/task_repo.go`

**Step 1: 扩展 ListByUserID 的 completed 与 all 分支**

在 `task_repo.go` 的 `ListByUserID` 中：

- `case "completed"`：若 `listID != nil && *listID != ""`，增加 `q = q.Where("list_id = ?", *listID)`；否则保持 `status = ?`, model.TaskStatusCompleted
- 新增 `case "completed-inbox"`：`q = q.Where("status = ? AND list_id IS NULL AND due_date IS NULL", model.TaskStatusCompleted)`
- `case "all"`：若 `listID != nil && *listID != ""`，增加 `q = q.Where("list_id = ?", *listID)`（清单页目前依赖前端过滤，此举让后端也按 listId 过滤，与 includeCompleted 逻辑一致）

**Step 2: 验证 build**

```bash
cd topi-api && go build ./...
```

**Step 3: Commit**

```bash
git add topi-api/internal/repository/task_repo.go
git commit -m "feat(repo): support listId and inbox filter for completed tasks"
```

---

### Task 2: 后端 Handler 解析 includeCompleted

**Files:**
- Modify: `topi-api/internal/handler/task_handler.go`

**Step 1: 解析 includeCompleted 并传入 Service**

在 `List` 方法中，增加：

```go
includeCompleted := c.Query("includeCompleted") == "true"
```

调用 `h.svc.List` 时传入该参数（需先扩展 Service 签名）。

**Step 2: 验证 build**

```bash
cd topi-api && go build ./...
```

**Step 3: Commit**

```bash
git add topi-api/internal/handler/task_handler.go
git commit -m "feat(handler): parse includeCompleted query param"
```

---

### Task 3: 后端 Service 层合并 active + completed

**Files:**
- Modify: `topi-api/internal/service/task_service.go`

**Step 1: 扩展 List 签名**

```go
func (s *TaskService) List(userID, filter string, listID *string, owner *string, date, startDate, endDate string, loc *time.Location, includeCompleted bool) ([]model.Task, error)
```

**Step 2: 实现 includeCompleted 逻辑**

当 `includeCompleted == true` 且 filter 为 `all`、`today`、`tomorrow`、`recent-seven`、`inbox` 或 listId 时：

- 调用 `repo.ListByUserID` 获取 active（现有逻辑）
- 获取 completed：
  - listId：`repo.ListByUserID(userID, "completed", listID, ownerParam)`
  - inbox：`repo.ListByUserID(userID, "completed-inbox", nil, ownerParam)`
  - today/tomorrow/recent-seven：`repo.ListByUserID(userID, "completed", nil, ownerParam)`，再在 service 内按 date/startDate/endDate 做内存过滤（复用现有 date 过滤逻辑）
  - all：`repo.ListByUserID(userID, "completed", nil, ownerParam)`
- 合并：`append(activeTasks, completedTasks...)`，返回

**Step 3: 更新 MCP 调用**

`topi-api/internal/mcp/handlers/task_handlers.go` 中 `ListTasks` 调用 `h.TaskSvc.List` 时，新增第 9 个参数 `false`（MCP 不返回 completed，保持原行为）。

**Step 4: 验证 build**

```bash
cd topi-api && go build ./...
```

**Step 5: Commit**

```bash
git add topi-api/internal/service/task_service.go topi-api/internal/handler/task_handler.go
git commit -m "feat(service): merge active and completed when includeCompleted=true"
```

---

### Task 4: 前端 useTasks 支持 includeCompleted

**Files:**
- Modify: `topi/app/hooks/use-tasks.ts`

**Step 1: filterToQuery 增加 includeCompleted 参数**

在 `filterToQuery` 的调用处或内部，当 `options?.includeCompleted === true` 且 filter 为清单视图时，在 params 中加 `includeCompleted: "true"`。

**Step 2: useTasks 接受 includeCompleted 选项**

```ts
export function useTasks(filter: TaskFilter, options?: { owner?: string; includeCompleted?: boolean })
```

**Step 3: 分组返回 activeTasks、completedTasks**

在 `filterTasks` 之后，按 `status === "completed"` 拆分为 `activeTasks` 和 `completedTasks`。当 `includeCompleted` 为 true 时，`filterTasks` 的输入需包含 completed 任务（需调整：当 includeCompleted 时，不要在前端过滤掉 completed，让 API 返回的 tasks 已包含两者，再在 filterTasks 或其后做分组）。

注意：当前 `filterTasks` 对 listId 只保留 `status === "active"`，会丢弃 completed。需修改逻辑：

- 当 `includeCompleted` 为 true：从 API 拿到的 tasks 已包含 active+completed，`filterTasks` 需调整为不按 status 过滤，而是分别处理；或拆成两个流。
- 简洁做法：`filterTasks` 保持原样处理「有效任务」，但增加一个分支：当 includeCompleted 时，对原始 tasks 先按 status 分组，active 进入 filterTasks，completed 进入另一组并做对应 filter（listId/date 等）。为减少重复，可让 filterTasks 返回 `{ active, completed }` 或拆成 `filterActiveTasks` 和 `filterCompletedTasks`。

更简实现：API 返回的已是合并后的 tasks。在 useTasks 中，拿到数据后按 `t.status === "completed"` 分为 completedTasks，其余为 activeTasks。然后 activeTasks 经过 filterTasks（此时 filterTasks 对 listId 等会过滤，但 API 已按相同条件返回，所以 active 部分其实已正确）。问题：filterTasks 会过滤掉 status !== active 的，所以 completed 会被丢弃。因此需要：

- 方案 A：修改 filterTasks，当 includeCompleted 时，对 active 和 completed 分别过滤，再合并返回。但 filterTasks 目前返回单一数组。
- 方案 B：useTasks 内部分两路：一路走 filterTasks 得到 activeTasks；另一路从原始 tasks 中取 status===completed 的，再按 filter 做内存过滤得到 completedTasks。filterTasks 不改，只用于 active。

采用 B。实现：
1. `queryFn` 返回的 `tasks` 当 includeCompleted 时已包含 active+completed
2. 对 tasks 按 status 分组：`activeTasks = filterTasks(tasks.filter(t=>t.status==='active'), filter, ...)` 但 filterTasks 的输入是全部 tasks，它内部会按 status 过滤。所以直接：`allFiltered = filterTasks(tasks, filter, refDate)` 会得到什么？对 listId，filterTasks 做 `t.status === "active" && t.listId === filter.listId`，completed 会被排除。所以 allFiltered 只有 active。
3. 我们需要：activeFiltered = filterTasks(tasks, filter, refDate) // 可能内部要允许 completed 通过？不，filterTasks 的职责就是按 view 过滤。我们应扩展：当 includeCompleted，filterTasks 返回 { active, completed }，其中 active 是原有逻辑，completed 是相同 filter 下的 completed 子集。
4. 更直接：不改 filterTasks。在 useTasks 中，`rawTasks` 来自 API。`activeTasks = filterTasks(rawTasks.filter(t=>t.status==='active'), filter, refDate)` —— 但 filterTasks 的输入通常包含所有 status，它内部会 filter。若传入只含 active 的数组，对 listId 会得到 listId 匹配的 active。OK。`completedTasks = filterTasksForCompleted(rawTasks.filter(t=>t.status==='completed'), filter, refDate)`。需要 filterTasksForCompleted：对 listId 做 listId 匹配；对 today/tomorrow/recent-seven 做 date 匹配；对 inbox 做 list_id null and due_date null；对 all 全保留。这样前端要重复一套 filter 逻辑。或者，依赖后端已经按 filter 正确返回，前端只按 status 分组即可？对！当 includeCompleted 时，后端返回的 tasks 已经是「该 filter 下的 active + completed」，所以前端不需要再按 filter 过滤，只需按 status 分组。顺序：active 在前，completed 在后（后端已 merge 好）。那 filterTasks 还有用吗？filterTasks 还做了排序。所以：从 API 拿到 tasks 后，若 includeCompleted，则 tasks 已是正确集合，只需按 status 拆成 activeTasks 和 completedTasks，各自排序。activeTasks 用现有排序，completedTasks 按 sort_order 或 completed_at 倒序。

但 filterTasks 还做了前端 date 过滤（today/tomorrow/recent-seven）—— 这些在后端 service 已经做了，所以 API 返回的已是过滤后的。OK。

精简 Step：
- useTasks options 增加 `includeCompleted?: boolean`
- filterToQuery 当 includeCompleted 时加 `includeCompleted: "true"`
- 当 includeCompleted 时，API 返回的 tasks 不经过 filterTasks 的 status 过滤？不，filterTasks 会过滤。我们应：当 includeCompleted 时，不走 filterTasks，而是直接按 status 分组。filterTasks 内部对 listId 会做 status==active 过滤，所以会丢弃 completed。因此必须在 useTasks 中判断：若 includeCompleted，则 `activeTasks = tasks.filter(t=>t.status==='active')` 再排序，`completedTasks = tasks.filter(t=>t.status==='completed')` 再排序；否则走原有 filterTasks 逻辑。但 today/tomorrow/recent-seven 的 date 过滤是在 service 做的，所以 API 返回的已经正确。前端 filterTasks 对 today 做的是 `isSameDay(t.dueDate, today)`，若 tasks 来自 API 且已过滤，这里再滤一次也无妨。为简化，当 includeCompleted 时，直接 `activeTasks = tasks.filter(t=>t.status==='active')`，`completedTasks = tasks.filter(t=>t.status==='completed')`，然后各自用相同的 sort（active 用现有，completed 用 sort_order）。不调用 filterTasks，因为 API 已经按 filter 正确返回了。

**Step 4: 返回 activeTasks、completedTasks**

当 `includeCompleted` 为 true 时，返回值增加 `activeTasks`、`completedTasks`；否则为兼容，`activeTasks = tasks`，`completedTasks = []`。

**Step 5: 验证**

手动在浏览器中请求带 `includeCompleted=true` 的接口，确认返回；再确认 useTasks 分组正确。

**Step 6: Commit**

```bash
git add topi/app/hooks/use-tasks.ts
git commit -m "feat(hooks): useTasks support includeCompleted and return active/completed"
```

---

### Task 5: TaskList 增加可折叠「已完成」区块

**Files:**
- Modify: `topi/app/components/task-list.tsx`
- Modify: `topi/app/components/task-page-with-detail.tsx`

**Step 1: TaskPageWithDetail 传入 includeCompleted**

对 mode 为 default 的清单页（all, today, tomorrow, recent-seven, inbox, listId），调用 useTasks 时传 `includeCompleted: true`。

**Step 2: TaskList 接受 completedTasks、渲染折叠区**

- Props 增加 `completedTasks?: Task[]`
- 当 `completedTasks` 且 `completedTasks.length > 0` 时，在主列表下方渲染可折叠区块
- 使用 `useState` 管理 `completedExpanded`，默认 `false`
- 标题：`已完成 (${completedTasks.length})`，点击切换展开
- 展开后渲染 `completedTasks`，复用现有 `renderTaskItem` 的逻辑，`mode` 传 `"completed"` 以支持恢复等操作

**Step 3: TaskPageWithDetail 将 completedTasks 传给 TaskList**

从 `useTasks` 拿到 `activeTasks`、`completedTasks`。主列表用 `activeTasks`，TaskList 的 `tasks` 改为 `activeTasks`，并传 `completedTasks`。注意 TaskList 内部使用 `tasksSource` 时，需同时能拿到 `activeTasks` 和 `completedTasks`。`tasksSource` 是 `useTasks` 的返回值，所以需在 `useTasks` 中返回 `completedTasks`，TaskList 从 `tasksSource?.completedTasks` 读取。

**Step 4: 主列表使用 activeTasks**

TaskPageWithDetail 传给 TaskList 的 `tasksSource` 需提供 `tasks: activeTasks`（或让 TaskList 用 tasksSource.tasks 作为主列表，此时 tasksSource.tasks 应为 activeTasks）。为最小改动，可在 TaskPageWithDetail 中：`tasksHook = useTasks(filter, { owner, includeCompleted })`，然后 `tasks` 从 hook 来。但 hook 返回的 `tasks` 当前是 filtered 后的单一数组。我们改为：当 includeCompleted 时，`tasks` 存 activeTasks（主列表），`completedTasks` 单独返回。这样 TaskList 的 `tasksSource.tasks` 即 activeTasks，`tasksSource.completedTasks` 即 completedTasks。

**Step 5: 验证**

在全部、今天、收集箱、自定义清单页分别确认：无 completed 时不显示区块；有 completed 时显示折叠区块，默认折叠，点击展开可恢复。

**Step 6: Commit**

```bash
git add topi/app/components/task-list.tsx topi/app/components/task-page-with-detail.tsx
git commit -m "feat(ui): add collapsible completed section to list pages"
```

---

### Task 6: 清单页路由传入 includeCompleted

**Files:**
- Modify: `topi/app/routes/all.tsx`
- Modify: `topi/app/routes/today.tsx`
- Modify: `topi/app/routes/tomorrow.tsx`
- Modify: `topi/app/routes/recent-seven.tsx`
- Modify: `topi/app/routes/inbox.tsx`
- Modify: `topi/app/routes/list.$listId.tsx`

**Step 1: 确认 TaskPageWithDetail 已处理**

上述路由均使用 `TaskPageWithDetail`，只需确保 `TaskPageWithDetail` 对 `mode === "default"` 时传 `includeCompleted: true`。若 TaskPageWithDetail 根据 filter 自动判断清单页，则无需改路由。检查：TaskPageWithDetail 的 `mode` 默认 `"default"`，`filter` 从路由传入。所以只要在 TaskPageWithDetail 内对 default 传 includeCompleted 即可，无需改各个 route 文件。若需显式区分，可在各 route 传 `showCompletedSection={true}` 之类的 prop，但设计上所有清单页都要，所以 TaskPageWithDetail 内部写死即可。Task 6 可简化为：验证所有清单页是否都经过 TaskPageWithDetail。已确认，无需修改 route 文件。将 Task 6 改为「验证与回归测试」。

**Step 2: 验证所有清单页**

- 访问 /、/today、/tomorrow、/recent-seven、/inbox、/list/xxx
- 确认有 completed 时显示折叠区块
- 确认 completed/abandoned/trash 页无该区块

**Step 3: Commit（若 Task 5 已覆盖则跳过）**

---

## 执行说明

按 Task 1 → Task 6 顺序实现，每步通过 build/手动验证后再提交。
