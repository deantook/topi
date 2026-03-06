# 删除确认使用 shadcn 弹窗

> **Goal:** 删除清单、删除任务均使用 shadcn AlertDialog 替代原生 `window.confirm`，统一交互与视觉。

## 1. 背景

- **删除清单：** 当前使用 `window.confirm`，样式与主题不符。
- **删除任务：** 无确认弹窗，直接执行删除/永久删除，易误触。
- **目标：** 两者均使用 shadcn AlertDialog，一致、可主题化、可访问。

## 2. 方案

抽离通用 `DeleteConfirmDialog` 组件，清单与任务删除共用。参考 `settings.tsx` 的 AlertDialog 受控用法。

## 3. 组件 API

**位置：** `topi/app/components/delete-confirm-dialog.tsx`

```ts
interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;   // 默认「删除」
  onConfirm: () => void | Promise<void>;
}
```

- 基于 shadcn `AlertDialog`
- 确认按钮 `variant="destructive"`
- `onConfirm` 可为异步，调用方在成功后 `onOpenChange(false)` 关闭

## 4. 集成

### 4.1 删除清单（custom-lists-sidebar.tsx）

- `CustomListItem` 增加 `deleteConfirmOpen` 状态
- 点击删除按钮：`setDeleteConfirmOpen(true)`，移除 `window.confirm`
- 弹窗：`title`「确定删除此清单？」；`description`「删除「${name}」后，其中的任务将移至收集箱。」
- `onConfirm`：调用 `onDelete()`，再 `setDeleteConfirmOpen(false)`

### 4.2 删除任务（task-list.tsx）

- TaskList 增加 `deleteConfirmTaskId: string | null`
- 右键「删除」/「永久删除」：设置 `deleteConfirmTaskId = task.id`，不直接 `handleDelete`
- 弹窗按模式区分：垃圾桶模式 `title`「永久删除此任务？」；否则「移至垃圾桶？」
- `description` 对应说明（可恢复 / 不可恢复）
- `onConfirm`：`handleDelete(deleteConfirmTaskId)`，清空 `deleteConfirmTaskId`
- 取消或遮罩关闭：`onOpenChange(false)` 清空 state

## 5. 错误与边界

- **删除失败：** 调用方在 `onConfirm` 内处理（如 toast），弹窗保持打开，可重试或取消
- **取消：** `onOpenChange(false)` 清空 state
- **无障碍：** AlertDialog 自带 ARIA 与焦点管理

## 6. 不做（YAGNI）

- 「放弃」任务不加确认弹窗
- 确认按钮加载态（可选，暂不实现）
