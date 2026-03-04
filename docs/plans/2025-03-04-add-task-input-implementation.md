# Add Task Input 交互改进 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将添加任务输入框的日期与优先级控件改为按需显示，抽出 AddTaskInput 组件，日期使用 Popover+Calendar+时间输入，优先级使用 DropdownMenu。

**Architecture:** 新建 AddTaskInput 组件承载添加任务表单；用 isFocused / addDueDate / addPriority 控制右侧控件显示；日期选择器用 Popover 包裹 shadcn Calendar 与时间 Input；优先级复用任务行内的 DropdownMenu 模式。TaskList 移除内联表单，改用 AddTaskInput。

**Tech Stack:** React, shadcn/ui (Popover, Calendar, DropdownMenu), lucide-react, Tailwind CSS

**Design Reference:** `docs/plans/2025-03-04-add-task-input-design.md`

---

### Task 1: 安装 shadcn Popover 和 Calendar

**Files:**
- Create: `topi/app/components/ui/popover.tsx`
- Create: `topi/app/components/ui/calendar.tsx`

**Step 1: 安装 Popover**

在 `topi/` 目录执行：
```bash
cd topi && npx shadcn@latest add popover
```
选择默认选项。若询问 overwrite，选择 No。

**Step 2: 验证 Popover 已创建**

确认 `topi/app/components/ui/popover.tsx` 存在且导出 `Popover`, `PopoverTrigger`, `PopoverContent`。

**Step 3: 安装 Calendar**

```bash
npx shadcn@latest add calendar
```
选择默认选项。Calendar 依赖 `react-day-picker`，安装时会自动添加。

**Step 4: 验证 Calendar 已创建**

确认 `topi/app/components/ui/calendar.tsx` 存在。检查 `package.json` 是否包含 `react-day-picker`。

**Step 5: Commit**

```bash
git add topi/app/components/ui/popover.tsx topi/app/components/ui/calendar.tsx topi/package.json topi/pnpm-lock.json
git commit -m "chore: add shadcn popover and calendar"
```

---

### Task 2: 提取优先级常量到共享位置

**Files:**
- Create: `topi/app/lib/task-constants.ts`
- Modify: `topi/app/components/task-list.tsx`（改为从 lib 导入）

**Step 1: 创建 task-constants.ts**

新建 `topi/app/lib/task-constants.ts`，内容：

```ts
import type { TaskPriority } from "@/hooks/use-tasks";

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
  none: "无",
};

export const PRIORITY_FLAG_CLASS: Record<TaskPriority, string> = {
  high: "text-red-500",
  medium: "text-blue-500",
  low: "text-muted-foreground",
  none: "text-muted-foreground/50",
};

export const PRIORITY_CHECKBOX_CLASS: Record<TaskPriority, string> = {
  high:
    "border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500",
  medium:
    "border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500",
  low:
    "border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:border-muted-foreground",
  none: "",
};
```

**Step 2: 修改 task-list.tsx 导入**

删除 task-list.tsx 中 `PRIORITY_LABEL`、`PRIORITY_FLAG_CLASS`、`PRIORITY_CHECKBOX_CLASS` 的定义，改为：

```ts
import {
  PRIORITY_LABEL,
  PRIORITY_FLAG_CLASS,
  PRIORITY_CHECKBOX_CLASS,
} from "@/lib/task-constants";
```

**Step 3: 运行 typecheck**

```bash
cd topi && pnpm run typecheck
```
Expected: PASS

**Step 4: Commit**

```bash
git add topi/app/lib/task-constants.ts topi/app/components/task-list.tsx
git commit -m "refactor: extract priority constants to task-constants"
```

---

### Task 3: 创建 AddTaskInput 组件骨架与基础表单

**Files:**
- Create: `topi/app/components/add-task-input.tsx`

**Step 1: 新建 AddTaskInput 基础结构**

创建 `topi/app/components/add-task-input.tsx`：

```tsx
"use client";

import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { TaskFilter, TaskPriority } from "@/hooks/use-tasks";
import { PRIORITY_LABEL } from "@/lib/task-constants";
import { cn } from "@/lib/utils";

export interface AddTaskInputProps {
  filter: TaskFilter;
  onSubmit: (
    text: string,
    options?: { listId?: string; dueDate?: string; priority?: TaskPriority }
  ) => void;
}

function formatDueDateForDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  const timePart = dateStr.length >= 19 ? dateStr.slice(11, 16) : null;
  return timePart
    ? `${parseInt(m, 10)}月${parseInt(d, 10)}日 ${timePart}`
    : `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

export function AddTaskInput({ filter, onSubmit }: AddTaskInputProps) {
  const [input, setInput] = useState("");
  const [addDueDate, setAddDueDate] = useState("");
  const [addPriority, setAddPriority] = useState<TaskPriority>("none");
  const [isFocused, setIsFocused] = useState(false);

  const showRightControls =
    isFocused || !!addDueDate || addPriority !== "none";

  const hideDatePicker = filter === "today" || filter === "tomorrow";

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) return;
      let options: {
        listId?: string;
        dueDate?: string;
        priority?: TaskPriority;
      } | undefined;
      if (typeof filter === "object" && "listId" in filter) {
        options = { listId: filter.listId };
      } else if (filter === "today" || filter === "tomorrow") {
        const d = new Date();
        if (filter === "tomorrow") d.setDate(d.getDate() + 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const h = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        options = { dueDate: `${y}-${m}-${day} ${h}:${min}:00` };
      }
      if (addDueDate) {
        const normalized = addDueDate.includes("T")
          ? addDueDate.replace("T", " ") + ":00"
          : addDueDate.length === 10
            ? addDueDate + " 00:00:00"
            : addDueDate;
        options = { ...options, dueDate: normalized };
      }
      if (addPriority !== "none") {
        options = { ...options, priority: addPriority };
      }
      onSubmit(trimmed, options);
      setInput("");
      setAddDueDate("");
      setAddPriority("none");
      setIsFocused(false);
    },
    [input, filter, addDueDate, addPriority, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="ml-5">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-gray-200 bg-muted/30 pl-3 pr-3 py-2 dark:border-gray-700"
        )}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
        <Plus className="size-4 shrink-0 text-muted-foreground text-[rgba(0,0,0,1)]" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="添加任务"
          className="h-8 flex-1 min-w-0 border-0 bg-transparent px-0 shadow-none text-[rgba(143,146,168,1)] placeholder:text-muted-foreground focus-visible:ring-0"
        />
        {showRightControls && !hideDatePicker && (
          <span className="text-xs text-muted-foreground">
            {addDueDate ? formatDueDateForDisplay(addDueDate) : "日期"}
          </span>
        )}
        {showRightControls && (
          <span className="text-xs text-muted-foreground">
            {PRIORITY_LABEL[addPriority]}
          </span>
        )}
      </div>
    </form>
  );
}
```

注意：表单容器使用 `onFocusCapture` 设置 `setIsFocused(true)`；`onBlur` 需在 Task 5 中完善，避免 Popover/Dropdown 打开时误触失焦。当前可先用 `onBlurCapture` + `setTimeout` 简单实现，后续 Task 5 再接入 `data-add-task-control` 检测。

**Step 2: 运行 typecheck**

```bash
cd topi && pnpm run typecheck
```
Expected: PASS

**Step 3: Commit**

```bash
git add topi/app/components/add-task-input.tsx
git commit -m "feat: add AddTaskInput component skeleton"
```

---

### Task 4: 实现日期 Popover（Calendar + 时间输入）

**Files:**
- Modify: `topi/app/components/add-task-input.tsx`

**Step 1: 在 AddTaskInput 中集成 Popover + Calendar**

- 导入 `Popover`, `PopoverTrigger`, `PopoverContent` 和 `Calendar`
- 将日期占位符替换为：点击 Calendar 图标打开 Popover，Popover 内上半部分为 Calendar，下半部分为时间 Input
- Calendar 使用 `mode="single"`，`selected` 来自 `addDueDate` 的日期部分，`onSelect` 更新日期
- 时间 Input：`type="text"` 或 `type="time"`，placeholder "00:00"，onChange 与日期拼接为 `YYYY-MM-DD HH:mm:ss`
- 增加「清除」按钮，点击后 `setAddDueDate("")` 并关闭 Popover
- 未设日期时，Trigger 仅显示 Calendar 图标；已设日期时显示格式化文本 + 图标
- 使用 `PopoverTrigger asChild` 包裹按钮/图标，`aria-label="截止日期"`

**Step 2: 处理日期时间拼接逻辑**

- 日期从 Calendar 得到 `Date | undefined`，转为 `YYYY-MM-DD`
- 时间从 Input 得到 `HH:mm`，校验正则 `/^([01]?\d|2[0-3]):([0-5]\d)$/`，无效则保留原值
- 拼接：`${date} ${time}:00`，若无时间则 `${date} 00:00:00`

**Step 3: 验证**

启动 dev server，聚焦添加输入框，点击日期图标，选择日期并输入时间，确认显示正确。点击清除后日期清空。

```bash
pnpm dev
```

**Step 4: Commit**

```bash
git add topi/app/components/add-task-input.tsx
git commit -m "feat: add date picker popover with calendar and time input"
```

---

### Task 5: 修正失焦逻辑（Popover/Dropdown 打开不触发失焦）

**Files:**
- Modify: `topi/app/components/add-task-input.tsx`

**Step 1: 使用 wrapper ref 检测外部点击**

- 用 `useRef` 指向表单容器 div
- 使用 `useEffect` + `mousedown`/`focusin` 监听：若事件 target 不在容器内且不是 Popover/Dropdown 的 portal 内，则 `setIsFocused(false)`
- 或使用 Radix 的 `DismissableLayer` 的 `onInteractOutside` 不关闭，但要避免将 isFocused 与 Popover 的 open 耦合
- 更简单做法：`onBlur` 使用 `e.relatedTarget` 判断，若 relatedTarget 在 PopoverContent/DropdownMenuContent 内则不 set false。但 Popover 通常渲染到 portal，relatedTarget 可能为 null
- 推荐：用 `setTimeout` 将 `setIsFocused(false)` 延迟到下一 tick，这样 Popover trigger 的 mousedown 不会立即触发 blur。或：用 `relatedTarget` 配合 `contains` 检查是否在表单容器或 document 中已挂载的 popover/dropdown 节点内

**实现方案：**

- 表单容器 div 使用 `ref={containerRef}`，并用 `onFocusCapture` / `onBlurCapture` 监听焦点的进入和离开（因为 focus 不冒泡，需用 capture）
- 在 `onBlurCapture` 中用 `setTimeout(0)` 延迟执行，在回调中检查：`document.activeElement` 是否在 `containerRef.current` 内，或是否在任一 `[data-add-task-control]` 的子树内（Popover/Dropdown 的 content 渲染到 portal，需单独标记）
- 为 `PopoverContent` 和 `DropdownMenuContent` 添加 `data-add-task-control` 属性，这样在 portal 内点击时不会误触发失焦

**Step 2: 实现**

在 AddTaskInput 的表单容器 div 上添加 `ref={containerRef}`，并实现上述任一方案。

**Step 3: 手动验证**

聚焦输入框，打开日期 Popover，点击日历选择日期，Popover 仍打开时不应触发右侧控件隐藏。点击组件外部后，若未设置日期/优先级则应隐藏。

**Step 4: Commit**

```bash
git add topi/app/components/add-task-input.tsx
git commit -m "fix: prevent blur when popover or dropdown is open"
```

---

### Task 6: 实现优先级 DropdownMenu

**Files:**
- Modify: `topi/app/components/add-task-input.tsx`

**Step 1: 添加优先级 DropdownMenu**

- 导入 `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuLabel`, `DropdownMenuTrigger`，`Button`，`Flag`，`PRIORITY_FLAG_CLASS`
- 将优先级占位 span 替换为 DropdownMenu
- Trigger：`Button variant="ghost" size="icon-xs"`，内部为 `<Flag className={PRIORITY_FLAG_CLASS[addPriority]} ... />`，`aria-label="优先级"`
- Content：与 task-list 中优先级区块一致，标题「优先级」，四选项（high/medium/low/none），每项为 button，点击 `setAddPriority(p)` 并关闭
- 使用 `DropdownMenuTrigger asChild`

**Step 2: 样式对齐**

复用 `task-list.tsx` 中 SortableTaskRow 的优先级选项样式（`rounded p-1 transition-all hover:bg-accent` 等）。

**Step 3: 手动验证**

聚焦输入框，点击旗帜图标，选择不同优先级，确认显示正确且提交后任务带有对应优先级。

**Step 4: Commit**

```bash
git add topi/app/components/add-task-input.tsx
git commit -m "feat: add priority dropdown menu to AddTaskInput"
```

---

### Task 7: 在 TaskList 中集成 AddTaskInput

**Files:**
- Modify: `topi/app/components/task-list.tsx`

**Step 1: 移除 TaskList 内添加任务相关状态与渲染**

- 删除 `input`, `setInput`, `addDueDate`, `setAddDueDate`, `addPriority`, `setAddPriority`
- 将 `handleSubmit` 逻辑改为调用 `addTask(trimmed, options)` 并通过 props 或闭包传给 AddTaskInput
- 删除内联表单的 JSX（约 501–541 行），替换为：

```tsx
{showAddInput && (
  <AddTaskInput
    filter={filter}
    onSubmit={(text, options) => addTask(text, options)}
  />
)}
```

**Step 2: 添加导入**

```ts
import { AddTaskInput } from "./add-task-input";
```

**Step 3: 验证 handleSubmit 与 filter 逻辑**

确保 `addTask` 的 options 正确处理 `listId`、`dueDate`、`priority`。today/tomorrow 时 AddTaskInput 内部会传入默认 dueDate，但设计文档说 today/tomorrow 不展示日期控件，日期由 filter 决定。检查 AddTaskInput 的 handleSubmit 中 today/tomorrow 的分支是否正确。

**Step 4: 运行 typecheck**

```bash
cd topi && pnpm run typecheck
```
Expected: PASS

**Step 5: Commit**

```bash
git add topi/app/components/task-list.tsx
git commit -m "feat: integrate AddTaskInput into TaskList"
```

---

### Task 8: 收尾与视觉对齐

**Files:**
- Modify: `topi/app/components/add-task-input.tsx`

**Step 1: 检查 placeholder 文案**

确认添加任务输入框的 placeholder 与设计一致。当前为「添加任务」，若设计文档或产品要求为「添加任务至“收集箱”」等动态文案，根据 filter 调整。

**Step 2: 检查 today/tomorrow 下 showRightControls**

当 filter 为 today/tomorrow 时，`hideDatePicker` 为 true，不显示日期控件；`showRightControls` 仍为 `isFocused || addPriority !== "none"`，因此优先级菜单在聚焦或已选优先级时仍显示。符合设计。

**Step 3: 无障碍**

确认日历图标、旗帜图标、Popover Trigger、Dropdown Trigger 均有 `aria-label`。Popover 和 DropdownMenu 默认支持键盘操作，无需额外改动。

**Step 4: Commit**

```bash
git add topi/app/components/add-task-input.tsx
git commit -m "chore: add-task-input polish and a11y"
```
