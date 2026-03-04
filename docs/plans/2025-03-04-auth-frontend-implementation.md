# Topi 前端登录注册与 API 接入实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 topi 前端的登录、注册功能，接入 topi-api 后端，将任务/清单数据从 localStorage 迁移到 API。

**Architecture:** 独立 /login、/register 页面；业务路由由 layout loader 保护；lib/api 封装 fetch 并自动携带 token；use-tasks、use-custom-lists 改为 API 调用。

**Tech Stack:** React Router 7, shadcn/ui, React Hook Form, Zod, Vite

**设计参考:** `docs/plans/2025-03-04-auth-frontend-design.md`

---

## Task 0: 后端新增移入垃圾桶接口（前置）

**Files:**
- Modify: `topi-api/internal/service/task_service.go`
- Modify: `topi-api/internal/handler/task_handler.go`
- Modify: `topi-api/internal/wire/wire.go`

**Step 1: TaskService 添加 MoveToTrash**

```go
func (s *TaskService) MoveToTrash(userID, id string) error {
	t, err := s.repo.GetByIDAndUserID(id, userID)
	// ... 同 Abandon 逻辑，设置 Status = TaskStatusTrash, Completed = false
}
```

**Step 2: TaskHandler 添加 Trash handler**

```go
func (h *TaskHandler) Trash(c *gin.Context) { ... }
```

**Step 3: wire 路由**

```go
auth.POST("/tasks/:id/trash", taskH.Trash)
```

**Step 4: wire 重新生成并 commit**

---

## Task 1: 依赖与环境变量

**Files:**
- Modify: `topi/package.json`
- Create: `topi/.env.example`

**Step 1: 安装 shadcn form**

```bash
cd topi
npx shadcn@latest add form
```

若未初始化 shadcn，先运行 `npx shadcn@latest init`。选择默认风格。

**Step 2: 创建 .env.example**

Create `topi/.env.example`:

```
VITE_API_URL=http://localhost:8080
```

**Step 3: 验证**

```bash
cd topi && npm run build
```

Expected: 成功构建

**Step 4: Commit**

```bash
git add topi/package.json topi/package-lock.json topi/.env.example topi/components.json
git commit -m "chore: add form deps and VITE_API_URL"
```

---

## Task 2: lib/api.ts

**Files:**
- Create: `topi/app/lib/api.ts`

**Step 1: 实现 API 客户端**

```typescript
// topi/app/lib/api.ts
const TOKEN_KEY = "token";

export function getApiUrl(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:8080";
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function request(
  path: string,
  options: RequestInit & { body?: unknown } = {}
): Promise<Response> {
  const { body, ...rest } = options;
  const url = `${getApiUrl()}/api/v1${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  return res;
}

export const apiClient = {
  get: (path: string) => request(path, { method: "GET" }),
  post: (path: string, opts?: { body?: unknown }) =>
    request(path, { method: "POST", ...opts }),
  patch: (path: string, opts?: { body?: unknown }) =>
    request(path, { method: "PATCH", ...opts }),
  delete: (path: string) => request(path, { method: "DELETE" }),
};
```

**Step 2: Commit**

```bash
git add topi/app/lib/api.ts
git commit -m "feat: add api client"
```

---

## Task 3: lib/auth.ts

**Files:**
- Create: `topi/app/lib/auth.ts`

**Step 1: 实现 token 与登出**

```typescript
// topi/app/lib/auth.ts
const TOKEN_KEY = "token";

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function logout(): void {
  removeToken();
  window.location.href = "/login";
}
```

**Step 2: Commit**

```bash
git add topi/app/lib/auth.ts
git commit -m "feat: add auth helpers"
```

---

## Task 4: 登录页 login.tsx

**Files:**
- Create: `topi/app/routes/login.tsx`

**Step 1: 实现登录表单**

使用 shadcn Form、Input、Button、Card。Zod 校验：username 非空，password 至少 6 位。提交调用 `POST /api/v1/login`，成功则 `setToken(res.data.token)`，`navigate(redirect ?? "/")`。支持 `?redirect=` query。底部链接到 `/register`。

参考 shadcn form 示例，字段：username, password。错误时显示 FormMessage 或 toast。

**Step 2: 验证**

访问 `/login`，表单可渲染，提交可触发请求。

**Step 3: Commit**

```bash
git add topi/app/routes/login.tsx
git commit -m "feat: add login page"
```

---

## Task 5: 注册页 register.tsx

**Files:**
- Create: `topi/app/routes/register.tsx`

**Step 1: 实现注册表单**

字段：username, password, confirmPassword。Zod：password >= 6，confirmPassword === password。提交 `POST /api/v1/register`。成功后可选：直接调用 login 获取 token，或跳转 `/login` 并 toast 注册成功。

**Step 2: Commit**

```bash
git add topi/app/routes/register.tsx
git commit -m "feat: add register page"
```

---

## Task 6: 路由配置与 loader 保护

**Files:**
- Modify: `topi/app/routes.ts`
- Modify: `topi/app/routes/layout.tsx`

**Step 1: 修改 routes.ts**

将 login、register 放在 layout 之外：

```typescript
import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  layout("routes/layout.tsx", [
    index("routes/all.tsx"),
    route("today", "routes/today.tsx"),
    // ... 其余不变
  ]),
] satisfies RouteConfig;
```

**Step 2: layout.tsx 添加 loader**

```typescript
import { redirect } from "react-router";
import { getToken } from "@/lib/auth";

export async function loader() {
  if (!getToken()) {
    throw redirect("/login");
  }
  return null;
}

// 其余 Layout 组件不变
```

**Step 3: 验证**

未登录访问 `/` 应跳转到 `/login`。登录后访问 `/` 正常。

**Step 4: Commit**

```bash
git add topi/app/routes.ts topi/app/routes/layout.tsx
git commit -m "feat: add route protection"
```

---

## Task 7: use-tasks 迁移到 API

**Files:**
- Modify: `topi/app/hooks/use-tasks.ts`

**Step 1: 重写 use-tasks**

- 删除 localStorage 逻辑
- 使用 `useState` + `useEffect` 或 `useCallback` 调用 `apiClient`
- `List`: `GET /tasks?filter=${filter}&listId=${listId}`
- `addTask`: `POST /tasks`，body: { title, listId?, dueDate? }
- `toggleTask`: `POST /tasks/:id/toggle`
- `updateTask`: `PATCH /tasks/:id`，body: { title?, listId?, dueDate? }
- `deleteTask`: permanent 时 `DELETE /tasks/:id`；否则 `POST /tasks/:id/trash`（Task 0 已添加）
- `abandonTask`: `POST /tasks/:id/abandon`
- `restoreTask`: `POST /tasks/:id/restore`
- `reorderTasks`: `POST /tasks/reorder`，body: { id, newIndex }
- API 返回 `{ data: T }`，取 `data` 使用
- 字段映射：后端 snake_case 转前端 camelCase（list_id->listId, due_date->dueDate, sort_order->order）

**Step 2: 添加 isLoading**

首次加载时 `isLoading=true`，请求完成后 `false`。

**Step 3: 验证**

登录后访问任务页，可拉取、创建、勾选任务。

**Step 4: Commit**

```bash
git add topi/app/hooks/use-tasks.ts
git commit -m "feat: migrate use-tasks to API"
```

---

## Task 8: use-custom-lists 迁移到 API

**Files:**
- Modify: `topi/app/hooks/use-custom-lists.ts`

**Step 1: 重写 use-custom-lists**

- `List`: `GET /lists`
- `addList`: `POST /lists`，body: { name }
- `updateList`: `PATCH /lists/:id`，body: { name }
- `deleteList`: `DELETE /lists/:id`
- 删除 localStorage，使用 state + API

**Step 2: Commit**

```bash
git add topi/app/hooks/use-custom-lists.ts
git commit -m "feat: migrate use-custom-lists to API"
```

---

## Task 9: AppLayout 增加登出按钮

**Files:**
- Modify: `topi/app/components/app-layout.tsx`

**Step 1: 在 SidebarFooter 增加退出**

在设置上方或 footer 内增加「退出」按钮，点击调用 `logout()`。

**Step 2: Commit**

```bash
git add topi/app/components/app-layout.tsx
git commit -m "feat: add logout button"
```

---

## Task 10: TaskList 加载态与错误处理

**Files:**
- Modify: `topi/app/hooks/use-tasks.ts`
- Modify: `topi/app/components/task-list.tsx`

**Step 1: 使用 isLoading**

若 `use-tasks` 返回 `isLoading`，TaskList 在加载时显示 Skeleton（已有 `@/components/ui/skeleton`）。

**Step 2: 错误提示**

API 失败时，可选 toast 或 inline 错误。若无 toast，可暂用 `console.error` 或简单 alert。

**Step 3: Commit**

```bash
git add topi/app/hooks/use-tasks.ts topi/app/components/task-list.tsx
git commit -m "feat: add loading state for tasks"
```

---

## Task 11: 端到端验证

**Step 1: 启动后端**

```bash
cd topi-api
go run ./cmd/server/
```

**Step 2: 启动前端**

```bash
cd topi
npm run dev
```

**Step 3: 手动测试**

1. 访问 `http://localhost:5173`，应跳转 `/login`
2. 注册新用户
3. 登录
4. 创建任务、清单，验证 CRUD

**Step 4: Commit**

若发现问题则修复并 commit。

---

## 执行选择

计划已保存至 `docs/plans/2025-03-04-auth-frontend-implementation.md`。两种执行方式：

**1. Subagent-Driven（本会话）** — 按任务调度子 agent，逐项实现并评审

**2. Parallel Session（独立会话）** — 在新会话中用 executing-plans 批量执行

请选择一种方式。
