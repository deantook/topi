# 任务详情富文本设计文档

**日期**: 2026-03-05  
**状态**: 已批准

## 概述

为任务增加「任务详情」字段，支持富文本（Markdown 存储、WYSIWYG 编辑）。页面新建任务时不支持添加详情；MCP 调用接口允许创建/更新时传入 `detail`。单击任务后在右侧显示详情编辑面板。

## 需求确认

| 项 | 选择 |
|----|------|
| 富文本存储格式 | Markdown |
| 编辑器体验 | 所见即所得（WYSIWYG，类似 Notion） |
| 小屏布局 | Sheet 抽屉，从侧边滑出覆盖任务列表 |
| 富文本库 | TipTap + Markdown 扩展 |

---

## 第一节：数据模型与 API

### 1.1 数据库

- 在 `tasks` 表新增字段 `detail`：
  - 类型：`TEXT`，可空
  - 内容：Markdown 字符串

### 1.2 REST API

| 接口 | 变更 |
|------|------|
| `GET /tasks` | 响应中增加 `detail`（snake_case: `detail`） |
| `GET /tasks/:id`（如有） | 同上 |
| `PATCH /tasks/:id` | body 支持可选 `detail` |
| `POST /tasks` | 不变，不支持 `detail`（页面新建不填详情） |
| `POST /tasks/batch` | 每个任务支持可选 `detail` |

### 1.3 MCP 工具

| 工具 | 变更 |
|------|------|
| `topi_create_task` | 增加可选参数 `detail` |
| `topi_create_tasks` | 每项任务支持可选 `detail` |
| `topi_update_task` | 增加可选参数 `detail` |
| `topi_list_tasks` | 返回结果包含 `detail` |

### 1.4 校验

- `detail` 可选，允许空字符串
- 建议限制长度（如 64KB）防止滥用

---

## 第二节：前端架构与布局

### 2.1 布局结构

- **桌面端**：左侧任务列表 + 右侧详情面板，可固定宽度比例或可拖拽分隔
- 未选中任务时：右侧显示空状态（如「点击任务查看详情」）
- **移动端**：单栏显示任务列表；点击任务后 Sheet 从右侧滑出覆盖列表

### 2.2 选中任务状态

- **URL 驱动**：`?selected=taskId`，例如 `/all?selected=xxx`
- 选中时更新 URL；刷新、分享、前进后退保持一致
- 路由通过 `useSearchParams` 读取 `selected` 并下传

### 2.3 组件职责

| 组件 | 职责 |
|------|------|
| 各路由页（all、today、list.$listId 等） | 解析 `selected`，渲染 TaskList + TaskDetailPanel |
| TaskList | 接收 `selectedId`、`onSelectTask`；单击任务行调用 `onSelectTask(task.id)` |
| TaskDetailPanel | 接收 `taskId \| null`，负责加载/展示/编辑详情；桌面端为侧栏，移动端为 Sheet |
| TaskDetailEditor | 封装 TipTap，Markdown 与 ProseMirror 互转，失焦或防抖后 onSave |

### 2.4 数据流

- 列表由 `useTasks` 提供，task 对象需包含 `detail`
- 选中任务后，TaskDetailPanel 用列表中的 task 或按需请求单条任务
- 保存成功后通过 `TASKS_CHANGED_EVENT` 或 `updateTask` 刷新列表中的 detail

---

## 第三节：编辑器组件

### 3.1 技术选型

- **TipTap**：WYSIWYG 富文本内核
- **tiptap-markdown** 或类似扩展：Markdown ↔ TipTap 文档互转
- 若无合适扩展，可自行实现简单的 `getMarkdown()` / `setMarkdown()` 转换

### 3.2 支持的格式（初版）

- **块级**：标题 H1/H2/H3、段落、无序列表、有序列表、引用
- **行内**：粗体、斜体、行内代码
- **暂不支持**：表格、代码块、图片（后续可扩展）

### 3.3 交互行为

- 受控组件：`value`（Markdown 字符串）、`onChange` / `onSave`
- 失焦或防抖（约 500ms）后触发保存
- 可提供工具栏（粗体、斜体、标题、列表）或先依赖快捷键（如 Cmd+B、Cmd+I）

### 3.4 与 shadcn 集成

- 编辑器容器复用 Card / Sheet 等布局
- 文案、空状态、加载态与整体 UI 风格统一
- 深色模式：TipTap 通过 `data-theme` 或 class 适配

### 3.5 Bundle 策略（vercel-react-best-practices）

- `React.lazy` + `Suspense` 懒加载 TipTap 与 TaskDetailPanel
- 仅当用户点击任务、打开详情面板时再加载编辑相关 JS

---

## 第四节：交互与 UX

### 4.1 点击行为

- **单击**：选中任务并展示右侧详情（桌面）或 Sheet（移动）
- **双击**：保持现有行为，进入标题内联编辑，不打开详情
- 任务行增加选中态（如 `data-selected` 或高亮样式）

### 4.2 保存与反馈

- 自动保存：失焦或防抖 500ms 后 PATCH
- 成功：静默更新，无 toast
- 失败：toast 提示错误，编辑器内容保留，可重试
- 可选：保存中轻量 loading 提示

### 4.3 响应式断点

- `md`（768px）及以上：左右分栏，详情面板常驻
- 小于 `md`：仅任务列表；点击任务后 Sheet 打开详情，提供关闭按钮或手势关闭

### 4.4 空状态与无详情

- 未选中任务：右侧显示「点击左侧任务查看或编辑详情」
- 选中任务但 detail 为空：占位「添加任务详情...」，点击即进入编辑

### 4.5 性能（vercel-react-best-practices）

- 详情面板与编辑器懒加载（见第三节）
- TaskDetailPanel 用 `React.memo`，依赖 `taskId` / `task` 变化
- 编辑器内防抖减少 onChange 触发频率
