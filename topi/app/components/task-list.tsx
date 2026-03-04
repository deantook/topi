"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  MoreHorizontal,
  Trash2,
  Calendar,
  Flag,
} from "lucide-react";
import { AddTaskInput } from "./add-task-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task, TaskFilter, TaskPriority } from "@/hooks/use-tasks";
import { useTasks } from "@/hooks/use-tasks";
import { useCustomLists } from "@/hooks/use-custom-lists";
import {
  PRIORITY_LABEL,
  PRIORITY_FLAG_CLASS,
  PRIORITY_CHECKBOX_CLASS,
} from "@/lib/task-constants";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function formatDueDate(dateStr: string | null, refDate = new Date()): string | null {
  if (!dateStr) return null;
  const datePart = dateStr.slice(0, 10);
  const timePart = dateStr.length >= 19 ? dateStr.slice(11, 16) : null; // HH:mm
  const toLocalDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = toLocalDate(refDate);
  const tomorrow = toLocalDate(new Date(refDate.getTime() + 86400000));
  if (datePart === today) return timePart ? `今天 ${timePart}` : "今天";
  if (datePart === tomorrow) return timePart ? `明天 ${timePart}` : "明天";
  const [y, m, d] = datePart.split("-");
  return timePart
    ? `${parseInt(m, 10)}月${parseInt(d, 10)}日 ${timePart}`
    : `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

function SortableTaskRow({
  task,
  mode,
  isEditing,
  isHovered,
  editingText,
  editingDueDateId,
  showListName,
  setHoverId,
  setEditingDueDateId,
  handleToggle,
  handleEditStart,
  handleEditSubmit,
  handleEditKeyDown,
  handleDelete,
  abandonTask,
  updateTask,
  getList,
  setEditingText,
}: {
  task: Task;
  mode: "default" | "completed" | "abandoned" | "trash";
  isEditing: boolean;
  isHovered: boolean;
  editingText: string;
  editingDueDateId: string | null;
  showListName: boolean;
  setHoverId: (id: string | null) => void;
  setEditingDueDateId: (id: string | null) => void;
  handleToggle: (task: Task) => void;
  handleEditStart: (task: Task) => void;
  handleEditSubmit: (e: React.FormEvent) => void;
  handleEditKeyDown: (e: React.KeyboardEvent, taskId: string) => void;
  handleDelete: (taskId: string) => void;
  abandonTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<Pick<Task, "title" | "dueDate" | "listId" | "priority">>) => void;
  getList: (id: string) => { name: string } | undefined;
  setEditingText: (s: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const contextMenuContent = (
    <ContextMenuContent className="w-40">
      <ContextMenuItem onClick={() => setEditingDueDateId(task.id)}>
        <Calendar className="size-4" />
        截止日期
      </ContextMenuItem>
      <div className="px-2 py-1.5">
        <ContextMenuLabel className="px-0 text-xs text-muted-foreground">优先级</ContextMenuLabel>
        <div className="mt-1.5 flex gap-1">
          {(["high", "medium", "low", "none"] as const).map((p) => {
            const isSelected = task.priority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => updateTask(task.id, { priority: p })}
                className={cn(
                  "rounded p-1 transition-all hover:bg-accent",
                  isSelected && "!bg-neutral-200 dark:!bg-neutral-700",
                  p === "none" && isSelected ? "text-neutral-500 dark:text-neutral-400" : PRIORITY_FLAG_CLASS[p]
                )}
                title={PRIORITY_LABEL[p]}
                aria-label={PRIORITY_LABEL[p]}
                aria-pressed={isSelected}
              >
                <Flag
                  className={cn("size-4 transition-transform", p === "none" && !isSelected && "opacity-50", isSelected && "scale-110")}
                  fill={p === "none" ? "none" : "currentColor"}
                  strokeWidth={isSelected ? 2 : 1.5}
                />
              </button>
            );
          })}
        </div>
      </div>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => handleDelete(task.id)} variant="destructive">
        <Trash2 className="size-4" />
        删除
      </ContextMenuItem>
      <ContextMenuItem onClick={() => abandonTask(task.id)}>放弃</ContextMenuItem>
    </ContextMenuContent>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            "group flex items-center gap-2 px-2 py-2 transition-colors cursor-text",
            isHovered && "bg-muted/50",
            isDragging && "opacity-90 shadow-md z-10"
          )}
          onMouseEnter={() => setHoverId(task.id)}
          onMouseLeave={() => setHoverId(null)}
          onDoubleClick={() => !task.completed && handleEditStart(task)}
        >
          <div
            {...listeners}
            {...attributes}
            className="touch-none shrink-0 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="size-4 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
          </div>
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => handleToggle(task)}
            aria-label={task.title}
            className={PRIORITY_CHECKBOX_CLASS[task.priority]}
          />
          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="min-w-0 flex-1">
              <input
                type="text"
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => handleEditKeyDown(e, task.id)}
                onBlur={handleEditSubmit}
                autoFocus
                className={cn(
                  "w-full min-w-0 truncate bg-transparent border-0 outline-none p-0 text-inherit focus:ring-0 focus-visible:ring-0",
                  task.completed && "text-muted-foreground line-through"
                )}
              />
            </form>
          ) : (
            <span className={cn("min-w-0 flex-1 truncate", task.completed && "text-muted-foreground line-through")}>
              {task.title}
            </span>
          )}
          {showListName && task.listId && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground bg-muted/50">
              {getList(task.listId)?.name ?? "·"}
            </span>
          )}
          {task.dueDate && editingDueDateId !== task.id && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground bg-muted/60">
              {formatDueDate(task.dueDate)}
            </span>
          )}
          {editingDueDateId === task.id ? (
            <input
              type="datetime-local"
              value={task.dueDate ? task.dueDate.replace(" ", "T").slice(0, 16) : ""}
              onChange={(e) => {
                const v = e.target.value;
                updateTask(task.id, { dueDate: v ? v.replace("T", " ") + ":00" : null });
                setEditingDueDateId(null);
              }}
              onBlur={() => setEditingDueDateId(null)}
              autoFocus
              className="h-7 rounded border bg-background px-1.5 text-xs"
            />
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" className={cn("shrink-0 opacity-0 group-hover:opacity-100", isHovered && "opacity-100")} aria-label="更多操作">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setEditingDueDateId(task.id)}>
                <Calendar className="size-4" />
                截止日期
              </DropdownMenuItem>
              <div className="px-2 py-1.5">
                <DropdownMenuLabel className="px-0 text-xs text-muted-foreground">优先级</DropdownMenuLabel>
                <div className="mt-1.5 flex gap-1">
                  {(["high", "medium", "low", "none"] as const).map((p) => {
                    const isSelected = task.priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => updateTask(task.id, { priority: p })}
                        className={cn(
                          "rounded p-1 transition-all hover:bg-accent",
                          isSelected && "!bg-neutral-200 dark:!bg-neutral-700",
                          p === "none" && isSelected ? "text-neutral-500 dark:text-neutral-400" : PRIORITY_FLAG_CLASS[p]
                        )}
                        title={PRIORITY_LABEL[p]}
                        aria-label={PRIORITY_LABEL[p]}
                        aria-pressed={isSelected}
                      >
                        <Flag
                          className={cn("size-4 transition-transform", p === "none" && !isSelected && "opacity-50", isSelected && "scale-110")}
                          fill={p === "none" ? "none" : "currentColor"}
                          strokeWidth={isSelected ? 2 : 1.5}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                <Trash2 className="size-4" />
                删除
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => abandonTask(task.id)}>放弃</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      {contextMenuContent}
    </ContextMenu>
  );
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
  const { tasks, addTask, toggleTask, updateTask, deleteTask, abandonTask, restoreTask, reorderTasks, isLoading } =
    useTasks(filter);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        reorderTasks(active.id as string, newIndex);
      }
    },
    [tasks, reorderTasks]
  );
  const { getList } = useCustomLists();

  const showListName =
    filter === "all" ||
    filter === "today" ||
    filter === "tomorrow" ||
    filter === "recent-seven";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingDueDateId, setEditingDueDateId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

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

    const contextMenuContent = (
      <ContextMenuContent className="w-40">
        {mode === "default" && (
          <>
            <ContextMenuItem onClick={() => setEditingDueDateId(task.id)}>
              <Calendar className="size-4" />
              截止日期
            </ContextMenuItem>
            <div className="px-2 py-1.5">
              <ContextMenuLabel className="px-0 text-xs text-muted-foreground">
                优先级
              </ContextMenuLabel>
              <div className="mt-1.5 flex gap-1">
                {(["high", "medium", "low", "none"] as const).map((p) => {
                  const isSelected = task.priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => updateTask(task.id, { priority: p })}
                      className={cn(
                        "rounded p-1 transition-all hover:bg-accent",
                        isSelected && "!bg-neutral-200 dark:!bg-neutral-700",
                        p === "none" && isSelected
                          ? "text-neutral-500 dark:text-neutral-400"
                          : PRIORITY_FLAG_CLASS[p]
                      )}
                      title={PRIORITY_LABEL[p]}
                      aria-label={PRIORITY_LABEL[p]}
                      aria-pressed={isSelected}
                    >
                      <Flag
                        className={cn(
                          "size-4 transition-transform",
                          p === "none" && !isSelected && "opacity-50",
                          isSelected && "scale-110"
                        )}
                        fill={p === "none" ? "none" : "currentColor"}
                        strokeWidth={isSelected ? 2 : 1.5}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        {(mode === "completed" || mode === "abandoned" || mode === "trash") && (
          <ContextMenuItem onClick={() => restoreTask(task.id)}>
            恢复
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => handleDelete(task.id)}
          variant="destructive"
        >
          <Trash2 className="size-4" />
          {mode === "trash" ? "永久删除" : "删除"}
        </ContextMenuItem>
        {mode === "default" && (
          <ContextMenuItem onClick={() => abandonTask(task.id)}>
            放弃
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    );

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
      <div
        key={task.id}
        className={cn(
          "group flex items-center gap-2 px-2 py-2 transition-colors cursor-text",
          isHovered && "bg-muted/50"
        )}
        onMouseEnter={() => setHoverId(task.id)}
        onMouseLeave={() => setHoverId(null)}
        onDoubleClick={() => mode === "default" && !task.completed && handleEditStart(task)}
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
          className={mode === "default" ? PRIORITY_CHECKBOX_CLASS[task.priority] : undefined}
        />
        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="min-w-0 flex-1">
            <input
              type="text"
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={(e) => handleEditKeyDown(e, task.id)}
              onBlur={handleEditSubmit}
              autoFocus
              className={cn(
                "w-full min-w-0 truncate bg-transparent border-0 outline-none p-0 text-inherit focus:ring-0 focus-visible:ring-0",
                task.completed && "text-muted-foreground line-through"
              )}
            />
          </form>
        ) : (
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              task.completed && "text-muted-foreground line-through"
            )}
          >
            {task.title}
          </span>
        )}
        {mode === "default" && (
          <>
            {showListName && task.listId && (
              <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground bg-muted/50">
                {getList(task.listId)?.name ?? "·"}
              </span>
            )}
            {task.dueDate && !editingDueDateId && (
              <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground bg-muted/60">
                {formatDueDate(task.dueDate)}
              </span>
            )}
          </>
        )}
        {editingDueDateId === task.id ? (
          <input
            type="datetime-local"
            value={
              task.dueDate
                ? task.dueDate.replace(" ", "T").slice(0, 16)
                : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              updateTask(
                task.id,
                { dueDate: v ? v.replace("T", " ") + ":00" : null }
              );
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
                <DropdownMenuItem onClick={() => setEditingDueDateId(task.id)}>
                  <Calendar className="size-4" />
                  截止日期
                </DropdownMenuItem>
                <div className="px-2 py-1.5">
                  <DropdownMenuLabel className="px-0 text-xs text-muted-foreground">
                    优先级
                  </DropdownMenuLabel>
                  <div className="mt-1.5 flex gap-1">
                    {(["high", "medium", "low", "none"] as const).map((p) => {
                      const isSelected = task.priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateTask(task.id, { priority: p })}
                          className={cn(
                            "rounded p-1 transition-all hover:bg-accent",
                            isSelected && "!bg-neutral-200 dark:!bg-neutral-700",
                            p === "none" && isSelected
                              ? "text-neutral-500 dark:text-neutral-400"
                              : PRIORITY_FLAG_CLASS[p]
                          )}
                          title={PRIORITY_LABEL[p]}
                          aria-label={PRIORITY_LABEL[p]}
                          aria-pressed={isSelected}
                        >
                          <Flag
                            className={cn(
                              "size-4 transition-transform",
                              p === "none" && !isSelected && "opacity-50",
                              isSelected && "scale-110"
                            )}
                            fill={p === "none" ? "none" : "currentColor"}
                            strokeWidth={isSelected ? 2 : 1.5}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
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
        </ContextMenuTrigger>
        {contextMenuContent}
      </ContextMenu>
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
        <AddTaskInput
          filter={filter}
          onSubmit={(text, options) => addTask(text, options)}
        />
      )}

      <div className="flex flex-col">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full rounded-none" />
            <Skeleton className="h-10 w-full rounded-none" />
            <Skeleton className="h-10 w-full rounded-none" />
          </>
        ) : tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {mode === "default"
              ? "暂无任务，添加一个吧"
              : "这里还没有内容"}
          </p>
        ) : mode === "default" && tasks.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map((task, index) => (
                <div key={task.id}>
                  {index > 0 && (
                    <div
                      className={cn(
                        "h-px bg-gray-200 dark:bg-gray-700",
                        mode === "default" ? "ml-14" : "ml-8"
                      )}
                      aria-hidden
                    />
                  )}
                  <SortableTaskRow
                  key={task.id}
                  task={task}
                  mode={mode}
                  isEditing={editingId === task.id}
                  isHovered={hoverId === task.id}
                  editingText={editingText}
                  editingDueDateId={editingDueDateId}
                  showListName={showListName}
                  setHoverId={setHoverId}
                  setEditingDueDateId={setEditingDueDateId}
                  handleToggle={handleToggle}
                  handleEditStart={handleEditStart}
                  handleEditSubmit={handleEditSubmit}
                  handleEditKeyDown={handleEditKeyDown}
                  handleDelete={handleDelete}
                  abandonTask={abandonTask}
                  updateTask={updateTask}
                  getList={getList}
                  setEditingText={setEditingText}
                />
                </div>
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          tasks.map((task, index) => (
            <div key={task.id}>
              {index > 0 && (
                <div
                  className={cn(
                    "h-px bg-gray-200 dark:bg-gray-700",
                    mode === "default" ? "ml-14" : "ml-8"
                  )}
                  aria-hidden
                />
              )}
              {renderTaskItem(task)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
