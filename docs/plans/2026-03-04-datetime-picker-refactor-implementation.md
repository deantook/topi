# DateTime Picker Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract shared DateTimePicker component with date+time selection and quick buttons (today/tomorrow/next Monday), apply to task add and task edit.

**Architecture:** New `DateTimePicker` and `DateTimePickerPopover` in single file; controlled component with `value`/`onChange`; AddTaskInput and TaskList consume via Popover.

**Tech Stack:** React, shadcn/ui (Calendar, Popover, Button), lucide-react, Tailwind

---

## Task 1: Create DateTimePicker core component

**Files:**
- Create: `topi/app/components/datetime-picker.tsx`

**Step 1: Create file with DateTimePicker**

- `DateTimePicker` props: `value: string | null`, `onChange: (v: string | null) => void`
- Internal: Calendar + `<input type="time">` + quick buttons row
- Quick logic:
  - 今天: `today 09:00`
  - 明天: `tomorrow 09:00`
  - 下周: next Monday 09:00 (if today is Mon → next Mon; else → first Mon after today)
- Use `formatDueDateForDisplay` for display; data format `YYYY-MM-DD HH:mm:ss`
- Reuse `isValidTime` from add-task-input or move to `@/lib` and import
- Bottom: 清除、确定 buttons
- Import Calendar, Button from shadcn; Sun, ArrowRight, CalendarDays from lucide-react

**Step 2: Verify component renders**

Run dev server, manually test if needed (or skip if no test setup).

**Step 3: Commit**

```bash
git add topi/app/components/datetime-picker.tsx
git commit -m "feat: add DateTimePicker component with quick buttons"
```

---

## Task 2: Add DateTimePickerPopover wrapper

**Files:**
- Modify: `topi/app/components/datetime-picker.tsx`

**Step 1: Add DateTimePickerPopover**

- Wraps Popover with DateTimePicker inside
- Props: `value`, `onChange`, `trigger`: ReactNode (default: Calendar icon button), `open?`, `onOpenChange?`
- On "清除": call onChange(null), close popover
- On "确定": close popover (value already applied by onChange)
- Export both DateTimePicker and DateTimePickerPopover

**Step 2: Commit**

```bash
git add topi/app/components/datetime-picker.tsx
git commit -m "feat: add DateTimePickerPopover wrapper"
```

---

## Task 3: Integrate into AddTaskInput

**Files:**
- Modify: `topi/app/components/add-task-input.tsx`

**Step 1: Replace Popover+Calendar+time with DateTimePickerPopover**

- Remove inline Calendar, time input, 清除 button from PopoverContent
- Import DateTimePickerPopover from `@/components/datetime-picker`
- Use `<DateTimePickerPopover value={addDueDate} onChange={setAddDueDate} trigger={...} open={datePopoverOpen} onOpenChange={setDatePopoverOpen} />`
- Trigger: existing Button (CalendarClock icon or date text)
- Move `formatDueDateForDisplay` to datetime-picker if shared, or keep local
- Ensure `isValidTime` / HH:mm logic is in DateTimePicker

**Step 2: Verify add-task flow**

- Add task with date: quick buttons work, calendar works, time works
- Clear works, submit works

**Step 3: Commit**

```bash
git add topi/app/components/add-task-input.tsx topi/app/components/datetime-picker.tsx
git commit -m "refactor: use DateTimePickerPopover in AddTaskInput"
```

---

## Task 4: Integrate into TaskList edit flow

**Files:**
- Modify: `topi/app/components/task-list.tsx`

**Step 1: Replace datetime-local with DateTimePickerPopover**

- Remove inline `<input type="datetime-local">` in both SortableTaskRow and renderTaskItem
- Add state: `editingDueDatePopoverTaskId: string | null` (or reuse editingDueDateId for "which task's popover is open")
- When `editingDueDateId === task.id`: render DateTimePickerPopover with trigger = date span or "设置截止日期"
- value={task.dueDate}, onChange={(v) => { updateTask(task.id, { dueDate: v }); setEditingDueDateId(null); }}
- Right-click "截止日期" → setEditingDueDateId(task.id) to open popover
- Trigger: the existing date span or a clickable area; when no dueDate, show "设置截止日期" or calendar icon

**Step 2: Wire context menu**

- "截止日期" menu item: onClick → setEditingDueDateId(task.id) (opens popover for that task)
- Ensure only one popover open at a time

**Step 3: Verify edit flow**

- Right-click → 截止日期 → popover opens
- Select date/time → 确定 → task updated, popover closes
- 清除 → dueDate cleared, popover closes

**Step 4: Commit**

```bash
git add topi/app/components/task-list.tsx
git commit -m "refactor: use DateTimePickerPopover for task due date edit"
```

---

## Task 5: Cleanup and polish

**Files:**
- Modify: `topi/app/components/add-task-input.tsx`
- Modify: `topi/app/components/datetime-picker.tsx`

**Step 1: Extract shared helpers**

- Move `formatDueDateForDisplay` to datetime-picker or `@/lib/date-utils` if used elsewhere
- Move `isValidTime` to `@/lib/date-utils` if not already
- Ensure no duplicate logic

**Step 2: Add aria-labels**

- Quick buttons: aria-label="今天", "明天", "下周"
- Calendar, time input: appropriate labels

**Step 3: Commit**

```bash
git add topi/app/components/add-task-input.tsx topi/app/components/datetime-picker.tsx topi/app/lib/date-utils.ts
git commit -m "chore: extract date utils, add aria-labels"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-04-datetime-picker-refactor-implementation.md`.

Two execution options:

1. **Subagent-Driven (this session)** - Dispatch fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
