# 任务详情富文本 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为任务增加 detail 字段（Markdown 存储），页面新建不支持填详情，MCP 允许；单击任务后在右侧显示 WYSIWYG 详情编辑面板；移动端用 Sheet 展示。

**Architecture:** 后端 model/repo/service/handler 及 MCP 增加 detail 支持；前端 useTasks 与 API 映射扩展 detail；各路由页解析 `?selected=`，TaskList 单击回调选中，TaskDetailPanel（桌面侧栏 + 移动 Sheet）懒加载；TaskDetailEditor 用 TipTap + Markdown 扩展，失焦/防抖自动保存。

**Tech Stack:** Go (GORM), React Router, TipTap, shadcn Sheet/Card, tiptap-markdown 或自实现 Markdown 转换

**Design Reference:** `docs/plans/2026-03-05-task-detail-rich-text-design.md`

---

## Task 1: 后端 model 增加 detail 字段

**Files:**
- Modify: `topi-api/internal/model/task.go`

**Step 1: 在 Task 结构体增加 Detail 字段**

在 `topi-api/internal/model/task.go` 的 `Task` 结构体中，`Title` 之后增加：

```go
Detail *string `gorm:"type:text" json:"detail,omitempty"`
```

**Step 2: 运行并验证**

```bash
cd topi-api && go build ./...
```
Expected: 无编译错误。

**Step 3: Commit**

```bash
git add topi-api/internal/model/task.go
git commit -m "feat(model): add detail field to Task"
```

---

## Task 2: 数据库迁移

**Files:**
- Create or extend migration to add `detail` column to `tasks` table

**Step 1: 创建迁移脚本**

若项目使用迁移工具（如 golang-migrate），创建迁移文件。若无迁移，在 README 或 migration 目录添加 SQL：

```sql
-- add_tasks_detail.sql
ALTER TABLE tasks ADD COLUMN detail TEXT DEFAULT NULL;
```

**Step 2: 执行迁移**

根据项目实际迁移流程执行（如 `migrate -path migrations -database "..." up` 或手动执行 SQL）。

**Step 3: Commit**

```bash
git add <migration_file_or_sql>
git commit -m "feat(db): add detail column to tasks"
```

---

## Task 3: TaskService Create/Update/BatchCreate 支持 detail

**Files:**
- Modify: `topi-api/internal/service/task_service.go`
- Modify: `topi-api/internal/service/task_service.go` 中 BatchTaskInput

**Step 1: 扩展 BatchTaskInput**

在 `BatchTaskInput` 结构体增加：

```go
Detail *string
```

**Step 2: Create 方法增加 detail 参数**

修改 `Create` 签名，增加 `detail *string` 参数，并在构建 `model.Task` 时设置 `Detail: detail`。

**Step 3: BatchCreate 中处理 detail**

在 `validatedTask` 与构建 `model.Task` 时增加 `detail` 字段处理，从 `BatchTaskInput.Detail` 传入。

**Step 4: Update 方法增加 detail**

修改 `Update` 函数签名，增加 `detail *string` 参数；在更新逻辑中若 `detail != nil` 则设置 `t.Detail = detail`。

**Step 5: 验证**

```bash
cd topi-api && go build ./...
```
Expected: 通过。注意 handler 与 MCP 尚未传入 detail，可能需临时传 nil。

**Step 6: Commit**

```bash
git add topi-api/internal/service/task_service.go
git commit -m "feat(service): support detail in Create/Update/BatchCreate"
```

---

## Task 4: TaskHandler Create/Update/CreateBatch 支持 detail

**Files:**
- Modify: `topi-api/internal/handler/task_handler.go`

**Step 1: CreateTaskReq 增加 Detail**

在 `CreateTaskReq` 中增加 `Detail *string`（注意：设计规定页面新建不填详情，REST POST /tasks 可不从 body 读 detail，为保持 API 一致性可保留字段但前端不传）。

**Step 2: UpdateTaskReq 增加 Detail**

在 `UpdateTaskReq` 中增加 `Detail *string`，并在调用 `svc.Update` 时传入 `req.Detail`。

**Step 3: CreateTasksBatchReq 的 CreateTaskReq**

`CreateTasksBatchReq` 的 `Tasks` 项已为 `CreateTaskReq`，在 `CreateTaskReq` 中增加 `Detail *string`；在 `CreateBatch` 中把 `Detail` 传入 `BatchTaskInput`。

**Step 4: Create 单条接口**

若设计上 POST /tasks 不支持 detail，则 Create 调用时传 `nil`；若要支持（例如未来扩展），则从 `req.Detail` 传入。

**Step 5: formatTaskForResponse 输出 detail**

在 `formatTaskForResponse` 或等效函数中，将 `task.Detail` 输出为 `detail`（snake_case 在 JSON tag 中为 `detail`）。

**Step 6: Commit**

```bash
git add topi-api/internal/handler/task_handler.go
git commit -m "feat(handler): support detail in task create/update/batch"
```

---

## Task 5: MCP task handlers 支持 detail

**Files:**
- Modify: `topi-api/internal/mcp/handlers/task_handlers.go`
- Modify: `topi-api/internal/service/task_service.go` 的 Create 签名（若 Task 4 中 Create 未传 detail，此处需确保 MCP 可传）

**Step 1: CreateTask 解析 detail**

在 `CreateTask` 中，从 `req.GetString("detail", "")` 读取；非空时传入 service Create。

**Step 2: CreateTasks 解析每项 detail**

在解析 `tasks` JSON 时，每项若有 `detail` 字段则写入 `BatchTaskInput.Detail`。

**Step 3: UpdateTask 解析 detail**

在 `UpdateTask` 的 args 中增加 `detail`，调用 `TaskSvc.Update` 时传入。

**Step 4: ListTasks 返回 detail**

在 `ListTasks` 的 output map 中增加 `"detail": t.Detail`。

**Step 5: 验证**

```bash
cd topi-api && go build ./...
```

**Step 6: Commit**

```bash
git add topi-api/internal/mcp/handlers/task_handlers.go
git commit -m "feat(mcp): support detail in create/update/list tasks"
```

---

## Task 6: 前端 Task 类型与 API 映射增加 detail

**Files:**
- Modify: `topi/app/hooks/use-tasks.ts`

**Step 1: Task 接口增加 detail**

在 `Task` 接口中增加 `detail: string | null`。

**Step 2: ApiTask 接口增加 detail**

在 `ApiTask` 中增加 `detail?: string | null`。

**Step 3: mapTask 映射 detail**

在 `mapTask` 中：`detail: r.detail ?? null`。

**Step 4: addTask options 不扩展 detail**

`addTask` 的 options 不增加 detail（设计规定页面新建不支持）。

**Step 5: updateTask 支持 detail**

在 `updateTask` 的 `Partial<Pick<...>>` 中增加 `detail`；在构建 `body` 时若 `updates.detail !== undefined` 则 `body.detail = updates.detail`。

**Step 6: Commit**

```bash
git add topi/app/hooks/use-tasks.ts
git commit -m "feat(frontend): add detail to Task type and updateTask"
```

---

## Task 7: 安装 TipTap 及 Markdown 扩展

**Files:**
- Modify: `topi/package.json`

**Step 1: 安装依赖**

```bash
cd topi && npm install @tiptap/react @tiptap/starter-kit @tiptap/pm
```
若需 Markdown 支持，可安装 `tiptap-markdown` 或搜索 `@tiptap/extension-markdown`（若有）。

```bash
npm install tiptap-markdown
# 或
npm install @tiptap/extension-markdown
```

（若 npm 上无现成包，可后续 Task 中自实现简单 Markdown 序列化。）

**Step 2: Commit**

```bash
git add topi/package.json topi/package-lock.json
git commit -m "chore: add TipTap dependencies"
```

---

## Task 8: 创建 TaskDetailEditor 组件骨架

**Files:**
- Create: `topi/app/components/task-detail-editor.tsx`

**Step 1: 创建基础组件**

创建 `TaskDetailEditor`，接收 `value: string`、`onSave: (markdown: string) => void`，内部先用 `<textarea>` 占位，`onBlur` 时调用 `onSave(value)`。后续替换为 TipTap。

**Step 2: 导出并验证**

确保组件可被导入，无 type 错误。

```bash
cd topi && npm run typecheck
```

**Step 3: Commit**

```bash
git add topi/app/components/task-detail-editor.tsx
git commit -m "feat: add TaskDetailEditor skeleton"
```

---

## Task 9: TaskDetailEditor 集成 TipTap

**Files:**
- Modify: `topi/app/components/task-detail-editor.tsx`

**Step 1: 使用 TipTap 替换 textarea**

使用 `useEditor`、`EditorContent`，配置 `StarterKit`（含段落、标题、列表、粗体斜体等）。

**Step 2: Markdown 转换**

若无现成扩展，实现简单 `markdownToHtml` / `htmlToMarkdown` 或使用 `marked` + `turndown`；或使用 `tiptap-markdown` 若已安装。在 `onCreate` 时用 `editor.commands.setContent(markdownToHtml(value))`，在 `onUpdate` 或 `onBlur` 时 `editor.storage.markdown.getMarkdown()` 或等价逻辑。

**Step 3: 防抖保存**

`onUpdate` 中使用 `useMemo` 或 `useCallback` + `setTimeout` 防抖 500ms 后调用 `onSave(markdown)`。

**Step 4: 深色模式**

确保 TipTap 的 wrapper 使用 `prose` 类，并与 `dark:` 样式兼容。

**Step 5: Commit**

```bash
git add topi/app/components/task-detail-editor.tsx
git commit -m "feat: integrate TipTap in TaskDetailEditor with Markdown"
```

---

## Task 10: 创建 TaskDetailPanel 组件

**Files:**
- Create: `topi/app/components/task-detail-panel.tsx`

**Step 1: 桌面端侧栏形态**

接收 `taskId: string | null`、`task: Task | null`、`onClose?: () => void`、`onSaveDetail: (id: string, detail: string) => void`。当 `taskId == null` 显示空状态「点击左侧任务查看或编辑详情」。当有 task 时显示 Card，内含任务标题、TaskDetailEditor，`onSave` 时调用 `onSaveDetail(taskId, markdown)`。

**Step 2: 移动端 Sheet 形态**

使用 `useMediaQuery` 或类似方式检测 `md` 断点。小于 `md` 时用 shadcn `Sheet` 包裹内容，`open={!!taskId}`，`onOpenChange` 在关闭时调用 `onClose`。桌面端不用 Sheet，直接渲染侧栏内容。

**Step 3: 懒加载**

`TaskDetailEditor` 用 `React.lazy` 导入，外层 `Suspense` fallback 为轻量 loading。

**Step 4: Commit**

```bash
git add topi/app/components/task-detail-panel.tsx
git commit -m "feat: add TaskDetailPanel with desktop sidebar and mobile Sheet"
```

---

## Task 11: 路由布局与 selected 状态

**Files:**
- Modify: `topi/app/routes/all.tsx`
- Modify: `topi/app/routes/today.tsx`
- Modify: `topi/app/routes/tomorrow.tsx`
- Modify: `topi/app/routes/recent-seven.tsx`
- Modify: `topi/app/routes/inbox.tsx`
- Modify: `topi/app/routes/list.$listId.tsx`
- 以及 completed、abandoned、trash（若需详情面板，可选）

**Step 1: 解析 selected**

在路由组件中使用 `useSearchParams` 获取 `selected`，如 `searchParams.get("selected")`。

**Step 2: 布局结构**

桌面端：`flex` 容器，左侧 `TaskList`（flex-1 min-w-0），右侧 `TaskDetailPanel`（固定宽度如 360px 或 flex-1）。移动端：仅 TaskList；TaskDetailPanel 以 Sheet 形式渲染，通过 `taskId` 控制显隐。

**Step 3: onSelectTask 更新 URL**

定义 `setSelected = (id: string | null) => { navigate(?) }`，用 `setSearchParams` 或 `navigate` 更新 `?selected=`。将 `selectedId` 与 `setSelected` 传给 TaskList 与 TaskDetailPanel。

**Step 4: 从 tasks 中取 task**

`TaskDetailPanel` 的 `task` 从 `tasks.find(t => t.id === selectedId)` 得到；若无则可为 null。

**Step 5: 逐路由修改**

先修改 `all.tsx` 作为模板，再复制到 today、tomorrow、recent-seven、inbox、list.$listId。

**Step 6: Commit**

```bash
git add topi/app/routes/*.tsx
git commit -m "feat: add selected task state and layout for detail panel"
```

---

## Task 12: TaskList 单击选中与双击编辑分离

**Files:**
- Modify: `topi/app/components/task-list.tsx`

**Step 1: 接收 selectedId 与 onSelectTask**

TaskList 增加 props：`selectedId?: string | null`、`onSelectTask?: (id: string | null) => void`。

**Step 2: 单击与双击分离**

在任务行（SortableTaskRow 与 renderTaskItem）的容器上：
- `onClick`: 调用 `onSelectTask?.(task.id)`（单击选中）
- `onDoubleClick`: 保持现有 `handleEditStart`（双击编辑标题），并 `stopPropagation` 避免触发单击。

注意：单击会先于双击触发，需用状态或定时器区分单击与双击，或采用「单击选中、双击进入编辑」的通用模式（延迟 200ms 判定双击，若为双击则取消选中并进入编辑）。

**Step 3: 选中态样式**

当 `task.id === selectedId` 时，给任务行加 `bg-muted/70` 或 `data-selected` 属性。

**Step 4: Commit**

```bash
git add topi/app/components/task-list.tsx
git commit -m "feat: TaskList single-click select and double-click edit"
```

---

## Task 13: 连接 onSaveDetail 与 updateTask

**Files:**
- Modify: `topi/app/routes/all.tsx`（及其他使用 TaskDetailPanel 的路由）
- Modify: `topi/app/components/task-detail-panel.tsx`（若需从外部传入 onSaveDetail）

**Step 1: 传递 onSaveDetail**

在路由中，`onSaveDetail` 调用 `updateTask(id, { detail })`，并 dispatch `TASKS_CHANGED_EVENT` 或由 `updateTask` 内部处理。

**Step 2: useTasks 的 updateTask 已支持 detail**

确认 Task 6 中 `updateTask` 已支持 `detail`，此处无需额外改动。

**Step 3: Commit**

```bash
git add topi/app/routes/*.tsx topi/app/components/task-detail-panel.tsx
git commit -m "feat: wire onSaveDetail to updateTask"
```

---

## Task 14: 空状态与无详情占位

**Files:**
- Modify: `topi/app/components/task-detail-panel.tsx`

**Step 1: 未选中任务空状态**

当 `taskId == null` 时，显示「点击左侧任务查看或编辑详情」类文案，居中或左对齐。

**Step 2: 选中但 detail 为空**

当 `task != null` 且 `(task.detail ?? "") === ""` 时，TaskDetailEditor 显示占位 "添加任务详情..."，点击即可编辑。

**Step 3: Commit**

```bash
git add topi/app/components/task-detail-panel.tsx
git commit -m "feat: empty states for no selection and no detail"
```

---

## Task 15: 保存失败 toast 反馈

**Files:**
- Modify: `topi/app/hooks/use-tasks.ts` 或调用 updateTask 的组件
- 确保有 `useToast` 或等效 toast 组件

**Step 1: updateTask 失败时 toast**

在 `updateTask` 的 catch 中，调用 `toast({ variant: "destructive", title: "保存失败", description: error.message })`。需确保 use-tasks 可访问 toast，或将 onError 作为 updateTask 的回调传入。

**Step 2: TaskDetailEditor 防抖保存**

保存逻辑在 Task 9 已实现；若保存失败，由 updateTask 的调用方（路由或 panel）显示 toast。

**Step 3: Commit**

```bash
git add topi/app/hooks/use-tasks.ts
git commit -m "feat: toast on detail save failure"
```

---

## Task 16: 验证与收尾

**Step 1: 端到端验证**

1. 启动 API 与前端
2. 创建任务（页面新建无 detail）
3. 单击任务，右侧出现详情面板
4. 输入 Markdown，失焦后自动保存
5. 刷新页面，detail 仍存在
6. 移动端（或缩小窗口）点击任务，Sheet 滑出
7. 通过 MCP 调用 `topi_create_task` 带 `detail`，验证可创建带详情的任务

**Step 2: 更新 MCP 文档**

在 `topi-api/docs/MCP.md` 或相关文档中补充 `detail` 参数说明。

**Step 3: 最终 Commit**

```bash
git add topi-api/docs/
git commit -m "docs: MCP detail parameter for task create/update"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-05-task-detail-rich-text-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
