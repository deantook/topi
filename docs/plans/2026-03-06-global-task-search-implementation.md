# 全局任务搜索功能 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现全局任务搜索，支持侧边栏图标 + Cmd+K 入口，点击结果跳转到任务所属清单/收集箱并展开详情。

**Architecture:** 后端扩展 GET /tasks 增加 q 参数，当 q 存在时调用 Search 路径（repo 层 title LIKE 模糊匹配，status in active/completed，limit 20）；前端安装 shadcn command，新增 useTaskSearch 与 TaskSearchCommand，在 AppLayout 集成侧边栏图标与 Cmd+K 监听。

**Tech Stack:** Go/Gin/GORM, React Router, shadcn/ui, cmdk, TanStack Query

---

## Task 1: 后端 - Repository 层 Search 方法

**Files:**
- Modify: `topi-api/internal/repository/task_repo.go`

**Step 1: 添加 Search 方法**

在 `task_repo.go` 末尾添加：

```go
// Search returns tasks matching q in title, status in (active, completed), limit results.
func (r *TaskRepository) Search(userID, q string, limit int) ([]model.Task, error) {
	if limit <= 0 {
		limit = 20
	}
	pattern := "%" + q + "%"
	var tasks []model.Task
	err := r.db.Where("user_id = ? AND (status = ? OR status = ?) AND title LIKE ?",
		userID, model.TaskStatusActive, model.TaskStatusCompleted, pattern).
		Order("sort_order").
		Limit(limit).
		Find(&tasks).Error
	return tasks, err
}
```

**Step 2: 验证**

```bash
cd topi-api && go build ./...
```

Expected: 无编译错误。

**Step 3: Commit**

```bash
git add topi-api/internal/repository/task_repo.go
git commit -m "feat(api): add TaskRepository.Search for title fuzzy match"
```

---

## Task 2: 后端 - Service 层 Search 方法

**Files:**
- Modify: `topi-api/internal/service/task_service.go`

**Step 1: 添加 Search 方法**

在 TaskService 上添加（可放在 List 方法附近）：

```go
// Search returns tasks matching q in title (active + completed only), limit 20.
func (s *TaskService) Search(userID, q string, limit int) ([]model.Task, error) {
	if q == "" {
		return nil, nil
	}
	q = strings.TrimSpace(q)
	if q == "" {
		return nil, nil
	}
	if limit <= 0 {
		limit = 20
	}
	return s.repo.Search(userID, q, limit)
}
```

确保文件顶部有 `"strings"` import。

**Step 2: 验证**

```bash
cd topi-api && go build ./...
```

**Step 3: Commit**

```bash
git add topi-api/internal/service/task_service.go
git commit -m "feat(api): add TaskService.Search"
```

---

## Task 3: 后端 - Handler 支持 q 参数

**Files:**
- Modify: `topi-api/internal/handler/task_handler.go`

**Step 1: 修改 List 方法**

在 List 方法开头，`filter := c.DefaultQuery(...)` 之后添加：

```go
q := strings.TrimSpace(c.Query("q"))
if q != "" {
	loc := time.UTC
	if val, exists := c.Get(timezone.ContextKey); exists && val != nil {
		if l, ok := val.(*time.Location); ok {
			loc = l
		}
	}
	tasks, err := h.svc.Search(userID, q, 20)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	out := make([]map[string]interface{}, 0, len(tasks))
	for _, t := range tasks {
		out = append(out, formatTaskForResponse(t, loc))
	}
	response.OK(c, out)
	return
}
```

确保有 `"strings"` import。

**Step 2: 验证**

```bash
cd topi-api && go build ./...
```

**Step 3: Commit**

```bash
git add topi-api/internal/handler/task_handler.go
git commit -m "feat(api): support q param in GET /tasks for search"
```

---

## Task 4: 前端 - 安装 shadcn command 组件

**Files:**
- Create: `topi/app/components/ui/command.tsx` (由 shadcn 生成)
- Modify: `topi/package.json` (可能增加 cmdk)

**Step 1: 安装**

```bash
cd topi && pnpm dlx shadcn@latest add command
```

按提示选择默认配置。

**Step 2: 验证**

```bash
cd topi && pnpm run build
```

Expected: 构建成功。

**Step 3: Commit**

```bash
git add topi/app/components/ui/command.tsx topi/package.json topi/pnpm-lock.yaml
git commit -m "chore(web): add shadcn command component"
```

---

## Task 5: 前端 - useTaskSearch hook

**Files:**
- Create: `topi/app/hooks/use-task-search.ts`

**Step 1: 实现 useTaskSearch**

```ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Task } from "./use-tasks";

interface ApiTask {
  id: string;
  title: string;
  completed: boolean;
  list_id: string | null;
  due_date: string | null;
  priority?: string;
  status: string;
  sort_order: number;
  created_at: string;
  owner?: string | null;
  estimated_hours?: number | null;
}

function mapTask(r: ApiTask): Task {
  const priority = (r.priority === "high" || r.priority === "medium" || r.priority === "low" ? r.priority : "none") as Task["priority"];
  const owner = r.owner === "human" || r.owner === "agent" ? r.owner : null;
  return {
    id: r.id,
    title: r.title,
    completed: r.completed,
    listId: r.list_id ?? null,
    dueDate: r.due_date ?? null,
    detail: null,
    priority,
    status: r.status as Task["status"],
    order: r.sort_order ?? 0,
    createdAt: r.created_at,
    owner,
    estimatedHours: typeof r.estimated_hours === "number" && r.estimated_hours >= 1 ? r.estimated_hours : null,
  };
}

export function useTaskSearch(q: string, enabled: boolean) {
  const res = useQuery({
    queryKey: ["task-search", q],
    queryFn: async () => {
      const res = (await apiClient.get(`/tasks?q=${encodeURIComponent(q)}`)) as { data: ApiTask[] };
      return (res.data ?? []).map(mapTask);
    },
    enabled: enabled && q.trim().length > 0,
    staleTime: 10_000,
  });
  return res;
}
```

**Step 2: 验证**

API 返回 `{ data: ApiTask[] }`（与 use-tasks 一致）。直接使用 `res.data` 即可。

**Step 3: Commit**

```bash
git add topi/app/hooks/use-task-search.ts
git commit -m "feat(web): add useTaskSearch hook"
```

---

## Task 6: 前端 - TaskSearchCommand 组件

**Files:**
- Create: `topi/app/components/task-search-command.tsx`

**Step 1: 实现组件**

参考 shadcn Command + CommandDialog 文档，实现：
- `open` / `onOpenChange` 受控
- CommandInput placeholder "搜索任务…"
- 使用 `useTaskSearch`（需 debounced q）
- CommandList 渲染结果项：标题、清单/收集箱名、截止日期、已完成标签
- 点击/Enter 时 `navigate(targetUrl)` 并 `onOpenChange(false)`
- 无输入时显示「输入关键词搜索」；有输入无结果时「未找到相关任务」
- 请求中显示 loading 或骨架

需从 `useDashboard` 或 `useListsFromDashboard` 获取 lists 以解析 list 名称。

**Step 2: 防抖**

使用 `useState` + `useEffect` 或 `useDeferredValue` 实现 200–300ms 防抖的 `debouncedQ`，传给 `useTaskSearch`。

**Step 3: 跳转 URL 逻辑**

```ts
function getTaskTargetUrl(task: Task): string {
  const base = task.listId ? `/list/${task.listId}` : "/inbox";
  return `${base}?selected=${task.id}`;
}
```

**Step 4: 验证**

在 AppLayout 中临时渲染 `<TaskSearchCommand open={true} onOpenChange={() => {}} />` 测试 UI。

**Step 5: Commit**

```bash
git add topi/app/components/task-search-command.tsx
git commit -m "feat(web): add TaskSearchCommand component"
```

---

## Task 7: 前端 - 集成到 AppLayout

**Files:**
- Modify: `topi/app/components/app-layout.tsx`

**Step 1: 集成 TaskSearchCommand**

- 添加 `useState` 控制 `searchOpen`
- 在 SidebarContent 最顶部（`<SidebarGroup className="pt-6">` 之前）增加搜索按钮：`SidebarMenuButton` 带 Search icon，`onClick={() => setSearchOpen(true)}`
- 在 Layout 根节点内渲染 `<TaskSearchCommand open={searchOpen} onOpenChange={setSearchOpen} />`

**Step 2: Cmd+K 监听**

在 AppLayout 内：

```ts
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen((v) => !v);
    }
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, []);
```

**Step 3: 导入 Search icon**

从 `lucide-react` 添加 `Search`。

**Step 4: 验证**

手动测试：点击搜索图标打开、Cmd+K 打开、输入搜索、选择结果跳转。

**Step 5: Commit**

```bash
git add topi/app/components/app-layout.tsx
git commit -m "feat(web): integrate TaskSearchCommand with sidebar icon and Cmd+K"
```

---

## Task 8: 边界与错误处理

**Files:**
- Modify: `topi/app/components/task-search-command.tsx`

**Step 1: 错误态**

当 `useTaskSearch` 返回 `isError` 时，显示「搜索失败，请重试」，可选重试按钮调用 `refetch`。

**Step 2: 清单已删除**

当 `task.listId` 在 lists 中找不到时，显示「已删除的清单」或「·」。

**Step 3: 空输入**

`q.trim() === ""` 时不发起请求，显示「输入关键词搜索」。

**Step 4: Commit**

```bash
git add topi/app/components/task-search-command.tsx
git commit -m "feat(web): task search error, empty, and deleted-list states"
```

---

## 执行选项

Plan complete and saved to `docs/plans/2026-03-06-global-task-search-implementation.md`.

**两种执行方式：**

**1. Subagent-Driven（当前会话）** — 按任务调度 subagent，每个任务完成后做代码审查。

**2. Parallel Session（独立会话）** — 在 worktree 中开启新会话，使用 executing-plans 按检查点批量执行。

**你希望用哪种？**
