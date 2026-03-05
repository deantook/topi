# 前后端请求优化实施计划

> **参考设计：** `docs/plans/2026-03-05-frontend-backend-request-optimization-design.md`

**目标：** 新增 `/api/v1/dashboard` 聚合接口，前端引入 React Query 替代重复请求，首屏请求从 ~9 次降至 2 次。

**约束：** 不改动现有 `/tasks`、`/lists` 等接口。

---

### Task 1: 后端 - TaskService 添加 GetCounts 方法

**Files:**
- Modify: `topi-api/internal/service/task_service.go`
- Modify: `topi-api/internal/repository/task_repo.go`（如需）

**Step 1: 在 task_repo 中新增 GetCountsByUserID（可选，或 service 内直接调用 List + 内存统计）**

若采用「一次 List all + 内存分组」最简实现，可不改 repo，在 service 内完成。

**Step 2: 在 TaskService 中实现 GetCounts**

```go
// DashboardCounts 返回各 filter 的数量，供 dashboard 接口使用
type DashboardCounts struct {
	All         int            `json:"all"`
	Today       int            `json:"today"`
	Tomorrow    int            `json:"tomorrow"`
	RecentSeven int            `json:"recentSeven"`
	Inbox       int            `json:"inbox"`
	Completed   int            `json:"completed"`
	Abandoned   int            `json:"abandoned"`
	Trash       int            `json:"trash"`
	List        map[string]int `json:"list"`
}

func (s *TaskService) GetCounts(userID string, loc *time.Location) (*DashboardCounts, error) {
	// 调用 repo.ListByUserID("all")、("completed")、("abandoned")、("trash") 或一次全量
	// 结合 loc 与当前日期计算 today/tomorrow/recent-seven/inbox，以及 list 分组
	// 返回 *DashboardCounts
}
```

实现时可复用 `List` 内 date 过滤逻辑，或调用 `repo.ListByUserID` 多次（all/completed/abandoned/trash）再计数。优先单次查询 + 内存分组以降低 DB 压力。

**Step 3: 运行测试**

```bash
cd topi-api; go build ./...
```

---

### Task 2: 后端 - 实现 DashboardHandler 与路由

**Files:**
- Create: `topi-api/internal/handler/dashboard_handler.go`
- Modify: `topi-api/internal/wire/wire.go`

**Step 1: 创建 DashboardHandler**

```go
package handler

import (
	"net/http"
	"time"

	"github.com/deantook/topi-api/internal/middleware"
	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/deantook/topi-api/pkg/timezone"
	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	taskSvc *service.TaskService
	listSvc *service.ListService
}

func NewDashboardHandler(taskSvc *service.TaskService, listSvc *service.ListService) *DashboardHandler {
	return &DashboardHandler{taskSvc: taskSvc, listSvc: listSvc}
}

func (h *DashboardHandler) Dashboard(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	loc := time.UTC
	if val, exists := c.Get(timezone.ContextKey); exists && val != nil {
		if l, ok := val.(*time.Location); ok {
			loc = l
		}
	}
	counts, err := h.taskSvc.GetCounts(userID, loc)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	lists, err := h.listSvc.List(userID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	// 格式化 lists：可与 list_handler 的 formatListForResponse 逻辑相同，提取为共享函数或在此处复制
	out := map[string]interface{}{
		"counts": counts,
		"lists":  formatListsForResponse(lists, loc),
	}
	response.OK(c, out)
}
```

需复用 `list_handler` 的 `formatListForResponse`，可提取到 `pkg/response` 或 `handler` 包内公共函数。

**Step 2: 在 wire.go 中注册**

- `wire.Build` 添加 `handler.NewDashboardHandler`（注意 wire 依赖：DashboardHandler 依赖 TaskService、ListService）
- `provideRouter` 增加 `dashboardH *handler.DashboardHandler` 参数
- 在 `auth` 组内添加：`auth.GET("/dashboard", dashboardH.Dashboard)`

**Step 3: 运行 wire 生成**

```bash
cd topi-api; go generate ./internal/wire/...
```

**Step 4: 启动 API 并验证**

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/v1/dashboard
```

应返回 `{ "data": { "counts": {...}, "lists": [...] } }`。

---

### Task 3: 前端 - 引入 React Query

**Files:**
- Modify: `topi/package.json`
- Modify: `topi/app/root.tsx` 或 `topi/app/routes/layout.tsx`

**Step 1: 安装依赖**

```bash
cd topi; pnpm add @tanstack/react-query
```

**Step 2: 创建 QueryClient 并包裹 Provider**

在 `root.tsx` 的 `Layout` 内、或 `layout.tsx` 的 `AppLayout` 外层（需在已登录布局内）包裹：

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

// 在需要的地方包裹
<QueryClientProvider client={queryClient}>
  ...
</QueryClientProvider>
```

建议：在 `root.tsx` 的 `ThemeProvider` 内包裹，使全站可用。或在 `layout.tsx` 中包裹 `AppLayout`，仅登录后路由使用（避免未登录时请求 dashboard）。

---

### Task 4: 前端 - 实现 Dashboard Query 并替换 useTaskCounts / useCustomLists

**Files:**
- Create: `topi/app/hooks/use-dashboard.ts`
- Modify: `topi/app/hooks/use-tasks.ts`（移除或重构 useTaskCounts）
- Modify: `topi/app/components/custom-lists-sidebar.tsx`
- Modify: `topi/app/components/app-layout.tsx`（或其他使用 useTaskCounts 的组件）
- Modify: `topi/app/components/task-list.tsx`（useCustomLists 改为 dashboard lists）
- Modify: `topi/app/routes/list.$listId.tsx`（getList 改为从 dashboard 获取）

**Step 1: 创建 useDashboard hook**

```ts
// use-dashboard.ts
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await apiClient.get("/dashboard") as { data: DashboardData };
      return res.data;
    },
  });
}
```

定义 `DashboardData` 类型与 `counts`、`lists` 结构。

**Step 2: 替换 useTaskCounts**

找到所有 `useTaskCounts()` 的用法（如 `AppLayout`、侧边栏），改为 `useDashboard().data?.counts`，处理 `isLoading` 和 `counts` 为 undefined 的初始状态。

**Step 3: 替换 useCustomLists**

- `CustomListsSidebar`：使用 `useDashboard().data?.lists`，增删改 list 后调用 `queryClient.invalidateQueries(["dashboard"])`
- `TaskList`：`getList(id)` 从 dashboard 的 lists 中查找
- `ListPage`：从 dashboard 的 lists 中取当前 list 名称

**Step 4: 列表 mutation 后 invalidate**

在 addList、updateList、deleteList 的回调中调用：

```ts
queryClient.invalidateQueries({ queryKey: ["dashboard"] });
```

---

### Task 5: 前端 - 将 useTasks 迁移到 React Query

**Files:**
- Modify: `topi/app/hooks/use-tasks.ts`

**Step 1: 用 useQuery 替代 useState + useEffect fetch**

- `queryKey`: `["tasks", filterKey]`
- `queryFn`: 调用 `apiClient.get` 构建 `/tasks` URL（含 filter、listId、date、startDate、endDate）
- 返回 `{ data: ApiTask[] }`，map 为 `Task[]`

**Step 2: 用 useMutation 替代增删改的 fetch + setState**

- Create、Update、Toggle、Abandon、Restore、Trash、Delete、Reorder 各自或复用 `useMutation`
- `onSuccess` 中：`queryClient.invalidateQueries({ queryKey: ["tasks"] })` 和 `queryClient.invalidateQueries({ queryKey: ["dashboard"] })`

**Step 3: 保持 useTasks 的对外 API 不变**

导出 `tasks`、`addTask`、`toggleTask` 等，内部实现改为 React Query。这样 `TaskPageWithDetail`、`TaskList` 等无需大改。

**Step 4: 移除 topi:tasks-changed 的 fetchCounts 监听（若已由 invalidate 覆盖）**

或保留作为兜底，但 dashboard 的 invalidate 应已足够。

---

### Task 6: 清理与验证

**Step 1: 移除冗余代码**

- `useTaskCounts` 若已完全替换，可删除
- `useCustomLists` 若已完全替换，可删除；否则保留给未迁移处

**Step 2: 验证请求量**

打开浏览器 DevTools Network，登录后进入「今天」页面：

- 预期：1 次 `/dashboard` + 1 次 `/tasks?filter=today`
- 切换至「明天」：1 次 `/tasks?filter=tomorrow`（dashboard 来自缓存）

**Step 3: 验证 mutation 后刷新**

Toggle、新增、删除任务后，counts 和 lists 应自动更新。

---

### 实施顺序总结

1. Task 1–2：后端 dashboard 接口
2. Task 3–4：前端 React Query + dashboard 替换
3. Task 5：useTasks 迁移
4. Task 6：清理与验证
