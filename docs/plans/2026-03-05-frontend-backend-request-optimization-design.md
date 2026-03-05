# 前后端请求优化设计

**日期**：2026-03-05  
**目标**：减少首屏请求数量，缓解服务器压力，提升慢速网络下的用户体验。

---

## 问题分析

当前首屏（如打开「今天」页面）约产生 9 次 API 请求：

| 来源 | 请求 |
|------|------|
| useTaskCounts | 4 次：/tasks, /tasks?filter=completed, /tasks?filter=abandoned, /tasks?filter=trash |
| useCustomLists × 3 | 3 次：/lists（CustomListsSidebar、TaskList、ListPage 各一份） |
| useTasks × 2 | 2 次：同一 filter 被 TaskPageWithDetail 与 TaskList 重复请求（部分页面已传 tasksSource 缓解） |

此外：无缓存、无去重、路由切换与窗口 focus 均会全量重新请求。

---

## 约束

1. **不改动现有 API**：`/tasks`、`/lists` 等保持原样，供 OpenAPI / MCP 使用。
2. **事件驱动**：无需 WebSocket，用户操作后通过 refetch / invalidate 更新即可。

---

## 方案：后端聚合 + React Query

### 一、后端：新增 `GET /api/v1/dashboard`

**职责**：一次返回 counts + lists，供首屏侧边栏和任务计数使用。

**响应格式**：

```json
{
  "data": {
    "counts": {
      "all": 10,
      "today": 2,
      "tomorrow": 1,
      "recentSeven": 5,
      "inbox": 3,
      "completed": 20,
      "abandoned": 1,
      "trash": 0,
      "list": { "list-id-1": 4, "list-id-2": 2 }
    },
    "lists": [
      { "id": "list-id-1", "name": "工作", "created_at": "..." },
      { "id": "list-id-2", "name": "购物", "created_at": "..." }
    ]
  }
}
```

**实现**：

- 新增 `DashboardHandler`，依赖 `TaskService`、`ListService`
- 新增 `TaskService.GetCounts(userID, loc)`：复用现有 repo 逻辑，通过 COUNT 或一次 List + 内存分组计算 all/today/tomorrow/inbox/recent-seven/completed/abandoned/trash/list 各 count
- `lists` 调用 `ListService.List(userID)`，沿用现有响应格式
- 路由：`auth.GET("/dashboard", dashboardH.Dashboard)`

---

### 二、前端：引入 React Query

- 依赖：`@tanstack/react-query`
- 在根组件包裹 `QueryClientProvider`
- 默认：`staleTime: 30_000`，`refetchOnWindowFocus: true`

---

### 三、前端：Dashboard Query

- **Query Key**：`["dashboard"]`
- **数据**：`GET /api/v1/dashboard` → `{ counts, lists }`
- **替换**：`useTaskCounts` 的 4 次请求、`useCustomLists` 的 3 处独立 fetch
- **失效**：任务/列表增删改后 `invalidateQueries(["dashboard"])`；focus 由 React Query 自动 refetch

---

### 四、前端：Tasks Query

- **Query Key**：`["tasks", filterKey]`（如 `["tasks", "today"]`、`["tasks", "list:xxx"]`）
- **数据**：沿用现有 `GET /api/v1/tasks`，不改接口
- **去重**：同一 filterKey 共享缓存
- **替换**：`useTasks` 内部 fetch 改为 `useQuery`，增删改用 `useMutation` + `invalidateQueries`

---

### 五、数据流与失效

1. 用户操作 → `useMutation` 调用 API
2. `onSuccess` 调用 `invalidateQueries(["dashboard"])` 和 `invalidateQueries({ queryKey: ["tasks"] })`
3. React Query 自动 refetch
4. 视情况保留 `topi:tasks-changed` 作为兜底

---

### 六、请求量对比

| 场景 | 改前 | 改后 |
|------|------|------|
| 首次打开「今天」 | ~9 次 | 2 次（/dashboard + /tasks?filter=today） |
| 切到「明天」 | ~9 次 | 1 次（/tasks?filter=tomorrow，dashboard 已缓存） |
| 窗口 focus 刷新 | 4+3+N | 2（dashboard + 当前 tasks） |
| 任务 toggle 后 | 4 次 useTaskCounts | 各 1 次 refetch |

---

## 实施顺序

1. 后端：实现 dashboard 接口
2. 前端：引入 React Query，实现 dashboard query，替换 useTaskCounts / useCustomLists
3. 前端：将 useTasks 迁移到 React Query
4. 清理：移除冗余事件监听、重复 fetch 逻辑
