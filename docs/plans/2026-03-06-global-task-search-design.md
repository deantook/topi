# 全局任务搜索功能设计

> 设计日期：2026-03-06

## 1. 需求概述

- **入口**：侧边栏顶部搜索图标 + Cmd+K（或 Ctrl+K）
- **搜索范围**：活跃任务 + 已完成任务（不含已放弃、回收站）
- **搜索字段**：仅标题
- **交互**：点击结果跳转到任务所属清单页或收集箱，并展开该任务详情；已完成任务也跳转到清单/收集箱（不跳转到已完成页）
- **结果展示**：标题、所属清单/收集箱、截止日期（如有）、完成状态标签

## 2. 架构与 API

### 2.1 后端

- 扩展 `GET /tasks`，增加可选参数：
  - `q`：搜索词，存在时启用搜索
  - 搜索时隐含 `searchScope=active,completed`（status in active, completed）
- 标题模糊匹配：SQL `LIKE '%q%'`（或等效）
- 限制返回数量：例如最多 20 条
- 响应格式保持现有任务结构，含 `list_id`；`list_id` 为 null 表示收集箱

### 2.2 前端数据流

- 新增 `useTaskSearch(q: string)`：
  - `q` 非空时调用 `GET /tasks?q=...`
  - 200–300ms 防抖
- 结合 `useDashboard` 的 `lists` 解析任务所属清单/收集箱名称

## 3. UI 组件与入口

### 3.1 组件

- **TaskSearchCommand**：基于 shadcn Command
  - CommandDialog 容器
  - CommandInput：placeholder「搜索任务…」
  - CommandList：渲染搜索结果项
- **结果项**：标题、所属清单/收集箱、截止日期、完成状态标签
- **空态**：无输入提示「输入关键词搜索」；有输入无结果提示「未找到相关任务」

### 3.2 入口

1. **Cmd+K / Ctrl+K**：在根布局监听 keydown，打开 CommandDialog
2. **侧边栏搜索图标**：Sidebar 顶部搜索按钮，点击打开同一 CommandDialog

### 3.3 依赖

- 安装 shadcn command：`pnpm dlx shadcn@latest add command`

## 4. 跳转逻辑与键盘交互

### 4.1 跳转规则

| 条件 | 目标 URL |
|------|----------|
| `task.listId === null` | `/inbox?selected={taskId}` |
| `task.listId` 有值 | `/list/{listId}?selected={taskId}` |

### 4.2 键盘

- Enter：确认当前高亮，跳转
- Escape：关闭
- 上下箭头：切换高亮
- 输入防抖：200–300ms

### 4.3 加载

- 请求中显示 loading / 骨架，避免空白

## 5. 异常与边界

### 5.1 错误

- 请求失败：toast「搜索失败，请重试」，结果区显示可重试提示
- 401：沿用现有 auth 流程

### 5.2 边界

| 情况 | 处理 |
|------|------|
| 清单已删除 | 显示「已删除的清单」或「·」 |
| `q` 为空或仅空格 | 不请求，显示空态 |
| 请求中选结果 | 允许选择并跳转 |

### 5.3 测试

- 后端：`q` 模糊匹配、status 过滤、limit
- 前端：防抖、跳转 URL、清单名解析、空态/错误态
- E2E（可选）：搜索 → 选择 → 验证跳转
