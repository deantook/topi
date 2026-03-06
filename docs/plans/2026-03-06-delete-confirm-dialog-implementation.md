# 删除确认 shadcn 弹窗 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 删除清单、删除任务均使用 shadcn AlertDialog 替代原生 `window.confirm`，通过通用 DeleteConfirmDialog 组件统一交互。

**Architecture:** 新建 DeleteConfirmDialog 封装 shadcn AlertDialog；custom-lists-sidebar 移除 window.confirm 改用弹窗；task-list 在删除/永久删除前增加确认弹窗。

**Tech Stack:** React, shadcn/ui (AlertDialog), TypeScript

**设计参考:** `docs/plans/2026-03-06-delete-confirm-dialog-design.md`

---

## Task 1: 创建 DeleteConfirmDialog 组件

**Files:**
- Create: `topi/app/components/delete-confirm-dialog.tsx`

**Step 1: 实现组件**

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "删除",
  onConfirm,
}: DeleteConfirmDialogProps) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // 删除失败时保持弹窗打开，便于重试
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 2: 验证**

```bash
cd topi && npm run build
```

Expected: 成功构建（组件未使用但可独立编译）

**Step 3: Commit**

```bash
git add topi/app/components/delete-confirm-dialog.tsx
git commit -m "feat(ui): add DeleteConfirmDialog component"
```

---

## Task 2: 删除清单改用 DeleteConfirmDialog

**Files:**
- Modify: `topi/app/components/custom-lists-sidebar.tsx`

**Step 1: 导入组件**

在文件顶部添加：

```tsx
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
```

**Step 2: CustomListItem 增加状态**

在 `CustomListItem` 内，`useState(false)` 旁增加：

```tsx
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
```

**Step 3: 删除按钮改为打开弹窗**

将删除按钮的 onClick（约 109–112 行）：

```tsx
onClick={(e) => {
  e.preventDefault();
  if (window.confirm(`确定删除「${name}」？`)) onDelete();
}}
```

替换为：

```tsx
onClick={(e) => {
  e.preventDefault();
  setDeleteConfirmOpen(true);
}}
```

**Step 4: 渲染 DeleteConfirmDialog**

在 `CustomListItem` 的 return 中，在 `</SidebarMenuItem>` 前（或在侧边栏结构合适处）添加：

```tsx
<DeleteConfirmDialog
  open={deleteConfirmOpen}
  onOpenChange={setDeleteConfirmOpen}
  title="确定删除此清单？"
  description={`删除「${name}」后，其中的任务将移至收集箱。`}
  onConfirm={() => onDelete()}
/>
```

**Step 5: 验证**

```bash
cd topi && npm run build
```

启动应用，在侧边栏点击某清单的删除图标，确认弹出 shadcn 弹窗而非浏览器 confirm；点取消关闭、点删除执行删除。

**Step 6: Commit**

```bash
git add topi/app/components/custom-lists-sidebar.tsx
git commit -m "feat(lists): replace window.confirm with DeleteConfirmDialog"
```

---

## Task 3: 删除任务增加 DeleteConfirmDialog

**Files:**
- Modify: `topi/app/components/task-list.tsx`

**Step 1: 导入组件**

在文件顶部添加：

```tsx
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
```

**Step 2: TaskList 增加状态**

在 TaskList 组件内，其他 `useState` 旁（约 420 行）增加：

```tsx
const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);
```

**Step 3: SortableTaskRow 改用 onRequestDelete**

- 将 SortableTaskRow 的 prop `handleDelete` 改为 `onRequestDelete: (taskId: string) => void`
- 在 ContextMenuItem（约 217 行）中，把 `onClick={() => handleDelete(task.id)}` 改为 `onClick={() => onRequestDelete(task.id)}`

在 TaskList 渲染 SortableTaskRow 处（约 813 行），把 `handleDelete={handleDelete}` 改为 `onRequestDelete={(id) => setDeleteConfirmTaskId(id)}`。

**Step 4: renderTaskItem 改用 setDeleteConfirmTaskId**

renderTaskItem 在 TaskList 内部，可直接使用 `setDeleteConfirmTaskId`。在 ContextMenuItem（约 581–582 行）中，把 `onClick={() => handleDelete(task.id)}` 改为 `onClick={() => setDeleteConfirmTaskId(task.id)}`。

**Step 5: 渲染 DeleteConfirmDialog**

在 TaskList 的 return 的顶层 div 内（与任务列表同级）添加：

```tsx
<DeleteConfirmDialog
  open={deleteConfirmTaskId !== null}
  onOpenChange={(open) => !open && setDeleteConfirmTaskId(null)}
  title={mode === "trash" ? "永久删除此任务？" : "移至垃圾桶？"}
  description={
    mode === "trash"
      ? "永久删除后无法恢复。"
      : "移至垃圾桶后可恢复。"
  }
  confirmLabel={mode === "trash" ? "永久删除" : "删除"}
  onConfirm={() => {
    if (deleteConfirmTaskId) {
      handleDelete(deleteConfirmTaskId);
    }
  }}
/>
```

**Step 6: 验证**

启动应用：
- 在今日/收件箱等页面，右键任务选「删除」→ 应弹出「移至垃圾桶？」弹窗
- 在垃圾桶页面，右键任务选「永久删除」→ 应弹出「永久删除此任务？」弹窗
- 取消关闭弹窗、确认执行删除

**Step 7: Commit**

```bash
git add topi/app/components/task-list.tsx
git commit -m "feat(tasks): add DeleteConfirmDialog for delete and permanent delete"
```

---

## Task 4: 最终验证

**Step 1: 全功能检查**

- 删除清单：侧边栏点击删除图标 → shadcn 弹窗 → 确认后清单删除、任务进收集箱
- 删除任务（非垃圾桶）：右键删除 → 弹窗 → 确认后任务进垃圾桶
- 永久删除（垃圾桶）：右键永久删除 → 弹窗 → 确认后任务永久删除

**Step 2: 构建**

```bash
cd topi && npm run build
```

Expected: 成功

---

## 注意事项

- SortableTaskRow 与 renderTaskItem 两处均需修改，因 TaskList 根据 showSort 切换使用两者之一。
- 确认后 `onConfirm` 调用 `handleDelete(deleteConfirmTaskId)`，DeleteConfirmDialog 内部 `onOpenChange(false)` 会触发父组件 `setDeleteConfirmTaskId(null)`（通过 `onOpenChange={(open) => !open && setDeleteConfirmTaskId(null)}`）。
