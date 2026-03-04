"use client";

import { useState, useCallback } from "react";
import { Plus, GripVertical, MoreHorizontal, Pencil, Trash2, Calendar } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task, TaskFilter } from "@/hooks/use-tasks";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function formatDueDate(dateStr: string | null, refDate = new Date()): string | null {
  if (!dateStr) return null;
  const today = refDate.toISOString().slice(0, 10);
  const tomorrow = new Date(refDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  if (dateStr === today) return "今天";
  if (dateStr === tomorrowStr) return "明天";
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

export interface TaskListProps {
  title: string;
  filter: TaskFilter;
  /** 是否显示排序按钮 */
  showSort?: boolean;
  /** 是否显示添加输入框（收集箱、垃圾桶等可能不需要） */
  showAddInput?: boolean;
  /** 完成模式：completed/abandoned/trash 页面隐藏添加框，且 checkbox 行为不同 */
  mode?: "default" | "completed" | "abandoned" | "trash";
}

export function TaskList({
  title,
  filter,
  showSort = true,
  showAddInput = true,
  mode = "default",
}: TaskListProps) {
  const { tasks, addTask, toggleTask, updateTask, deleteTask, abandonTask, restoreTask, isLoading } =
    useTasks(filter);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingDueDateId, setEditingDueDateId] = useState<string | null>(null);
  const [addDueDate, setAddDueDate] = useState<string>("");
  const [hoverId, setHoverId] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) return;
      let options: { listId?: string; dueDate?: string } | undefined;
      if (typeof filter === "object" && "listId" in filter) {
        options = { listId: filter.listId };
      } else if (filter === "today" || filter === "tomorrow") {
        const d = new Date();
        if (filter === "tomorrow") d.setDate(d.getDate() + 1);
        options = { dueDate: d.toISOString().slice(0, 10) };
      } else if (addDueDate) {
        options = { dueDate: addDueDate };
      }
      addTask(trimmed, options);
      setInput("");
    },
    [input, filter, addTask, addDueDate]
  );

  const handleToggle = useCallback(
    (task: Task) => {
      if (mode === "default") {
        toggleTask(task.id);
      } else if (mode === "completed" || mode === "abandoned" || mode === "trash") {
        restoreTask(task.id);
      }
    },
    [mode, toggleTask, restoreTask]
  );

  const handleEditStart = useCallback((task: Task) => {
    setEditingId(task.id);
    setEditingText(task.title);
  }, []);

  const handleEditSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (editingId && editingText.trim()) {
        updateTask(editingId, { title: editingText.trim() });
      }
      setEditingId(null);
      setEditingText("");
    },
    [editingId, editingText, updateTask]
  );

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent, taskId: string) => {
      if (e.key === "Escape") {
        setEditingId(null);
        setEditingText("");
      } else if (e.key === "Enter") {
        handleEditSubmit(e as unknown as React.FormEvent);
      }
    },
    [handleEditSubmit]
  );

  const handleDelete = useCallback(
    (taskId: string) => {
      if (mode === "trash") {
        deleteTask(taskId, true);
      } else {
        deleteTask(taskId, false);
      }
    },
    [mode, deleteTask]
  );

  const renderTaskItem = (task: Task) => {
    const isEditing = editingId === task.id;
    const isHovered = hoverId === task.id;

    return (
      <div
        key={task.id}
        className={cn(
          "group flex items-center gap-2 rounded-md px-2 py-2 transition-colors",
          isHovered && "bg-muted/50"
        )}
        onMouseEnter={() => setHoverId(task.id)}
        onMouseLeave={() => setHoverId(null)}
      >
        {mode === "default" && (
          <GripVertical
            className="size-4 shrink-0 cursor-grab text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          />
        )}
        <Checkbox
          checked={task.completed || mode !== "default"}
          onCheckedChange={() => handleToggle(task)}
          aria-label={task.title}
        />
        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="flex-1">
            <Input
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={(e) => handleEditKeyDown(e, task.id)}
              onBlur={handleEditSubmit}
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              autoFocus
            />
          </form>
        ) : (
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              task.completed && "text-muted-foreground line-through"
            )}
            onDoubleClick={() => handleEditStart(task)}
          >
            {task.title}
          </span>
        )}
        {mode === "default" && task.dueDate && !editingDueDateId && (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground bg-muted/60">
            {formatDueDate(task.dueDate)}
          </span>
        )}
        {editingDueDateId === task.id ? (
          <input
            type="date"
            value={task.dueDate ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              updateTask(task.id, { dueDate: v });
              setEditingDueDateId(null);
            }}
            onBlur={() => setEditingDueDateId(null)}
            autoFocus
            className="h-7 rounded border bg-background px-1.5 text-xs"
          />
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn(
                "shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
                isHovered && "opacity-100"
              )}
              aria-label="更多操作"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {mode === "default" && (
              <>
                <DropdownMenuItem onClick={() => handleEditStart(task)}>
                  <Pencil className="size-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditingDueDateId(task.id)}>
                  <Calendar className="size-4" />
                  截止日期
                </DropdownMenuItem>
              </>
            )}
            {(mode === "completed" || mode === "abandoned" || mode === "trash") && (
              <DropdownMenuItem onClick={() => restoreTask(task.id)}>
                恢复
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDelete(task.id)}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="size-4" />
              {mode === "trash" ? "永久删除" : "删除"}
            </DropdownMenuItem>
            {mode === "default" && (
              <DropdownMenuItem onClick={() => abandonTask(task.id)}>
                放弃
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {showSort && (
          <Button variant="ghost" size="icon-sm" aria-label="排序">
            <span className="text-xs">1↓</span>
          </Button>
        )}
      </div>

      {showAddInput && (
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Plus className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="添加任务"
              className="h-8 flex-1 min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
            {filter !== "today" && filter !== "tomorrow" && (
              <input
                type="date"
                value={addDueDate}
                onChange={(e) => setAddDueDate(e.target.value)}
                className="h-7 rounded border-0 bg-transparent text-xs text-muted-foreground"
                title="截止日期"
                aria-label="截止日期"
              />
            )}
          </div>
        </form>
      )}

      <div className="flex flex-col gap-0.5">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </>
        ) : tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {mode === "default"
              ? "暂无任务，添加一个吧"
              : "这里还没有内容"}
          </p>
        ) : (
          tasks.map(renderTaskItem)
        )}
      </div>
    </div>
  );
}
