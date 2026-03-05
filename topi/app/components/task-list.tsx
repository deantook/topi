"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
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
  Trash2,
  Calendar,
  Flag,
  User,
  Bot,
} from "lucide-react";
import { AddTaskInput } from "./add-task-input";
import { DateTimePickerPopover } from "./datetime-picker";
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
import type { Task, TaskFilter, TaskPriority } from "@/hooks/use-tasks";
import { useTasks } from "@/hooks/use-tasks";
import { useListsFromDashboard } from "@/hooks/use-lists-from-dashboard";
import {
  PRIORITY_LABEL,
  PRIORITY_FLAG_CLASS,
  PRIORITY_CHECKBOX_CLASS,
  OWNER_LABEL,
} from "@/lib/task-constants";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function getWeekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
  return x;
}

function formatDueDate(dateStr: string | null, refDate = new Date()): string | null {
  if (!dateStr) return null;
  const datePart = dateStr.slice(0, 10);
  const toLocalDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = toLocalDate(refDate);
  const tomorrow = toLocalDate(new Date(refDate.getTime() + 86400000));
  const timePart = dateStr.length >= 19 ? dateStr.slice(11, 16) : null;
  const taskDate = new Date(datePart + "T12:00:00");

  if (datePart === today) return timePart ?? "今天";
  if (datePart === tomorrow) return "明天";

  const refWeekStart = toLocalDate(getWeekStart(refDate));
  const taskWeekStart = toLocalDate(getWeekStart(taskDate));
  if (refWeekStart === taskWeekStart) {
    return WEEKDAY_NAMES[taskDate.getDay()];
  }

  const [y, m, d] = datePart.split("-");
  const taskYear = parseInt(y, 10);
  const refYear = refDate.getFullYear();
  if (taskYear === refYear) {
    return `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
  }
  return `${taskYear}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

const CLICK_DELAY_MS = 250;

function SortableTaskRow({
  task,
  mode,
  isEditing,
  isHovered,
  isSelected,
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
  onSelectTask,
}: {
  task: Task;
  mode: "default" | "completed" | "abandoned" | "trash";
  isEditing: boolean;
  isHovered: boolean;
  isSelected: boolean;
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
  onSelectTask?: (id: string | null) => void;
}) {
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    if (!onSelectTask || mode !== "default") return;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null;
      onSelectTask(task.id);
    }, CLICK_DELAY_MS);
  }, [onSelectTask, mode, task.id]);

  const handleDoubleClick = useCallback(() => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    if (mode === "default" && !task.completed) handleEditStart(task);
  }, [mode, task, handleEditStart]);

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
            (isHovered || isSelected) && "bg-muted/50",
            isSelected && "bg-muted/70",
            isDragging && "opacity-90 shadow-md z-10"
          )}
          onMouseEnter={() => setHoverId(task.id)}
          onMouseLeave={() => setHoverId(null)}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
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
          {task.owner === "human" && (
            <span className="shrink-0 inline-flex" title={OWNER_LABEL.human} aria-label={OWNER_LABEL.human}>
              <User className="size-3.5 text-muted-foreground" />
            </span>
          )}
          {task.owner === "agent" && (
            <span className="shrink-0 inline-flex" title={OWNER_LABEL.agent} aria-label={OWNER_LABEL.agent}>
              <Bot className="size-3.5 text-muted-foreground" />
            </span>
          )}
          <DateTimePickerPopover
            value={task.dueDate ?? null}
            onChange={(v) => updateTask(task.id, { dueDate: v })}
            open={editingDueDateId === task.id}
            onOpenChange={(open) => setEditingDueDateId(open ? task.id : null)}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "shrink-0 h-auto rounded px-1.5 py-0.5 text-xs text-muted-foreground bg-muted/60 hover:bg-muted/80",
                  !task.dueDate && "invisible min-w-[5rem]"
                )}
                aria-label="设置截止日期"
              >
                {task.dueDate ? formatDueDate(task.dueDate) : "\u200B"}
              </Button>
            }
          />
        </div>
      </ContextMenuTrigger>
      {contextMenuContent}
    </ContextMenu>
  );
}

type TasksSource = ReturnType<typeof useTasks>;

export interface TaskListProps {
  title: string;
  filter: TaskFilter;
  /** 是否显示排序按钮 */
  showSort?: boolean;
  /** 是否显示添加输入框（收集箱、垃圾桶等可能不需要） */
  showAddInput?: boolean;
  /** 完成模式：completed/abandoned/trash 页面隐藏添加框，且 checkbox 行为不同 */
  mode?: "default" | "completed" | "abandoned" | "trash";
  /** 当前选中的任务 ID，用于详情面板 */
  selectedId?: string | null;
  /** 单击任务时选中，用于打开详情面板 */
  onSelectTask?: (id: string | null) => void;
  /** 可选：来自父组件的 useTasks 结果，用于共享同一数据源（如 TaskPageWithDetail） */
  tasksSource?: TasksSource;
}

const SKELETON_DELAY_MS = 200;

const OWNER_FILTER_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: "全部" },
  { value: "human", label: "我" },
  { value: "agent", label: "Agent" },
];

export function TaskList({
  title,
  filter,
  showSort = true,
  showAddInput = true,
  mode = "default",
  selectedId,
  onSelectTask,
  tasksSource,
}: TaskListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const ownerParam = searchParams.get("owner");
  const currentOwner = ownerParam === "human" || ownerParam === "agent" ? ownerParam : null;
  const ownerForQuery = currentOwner ?? undefined;

  const fallback = useTasks(filter, { owner: ownerForQuery });
  const { tasks, addTask, toggleTask, updateTask, deleteTask, abandonTask, restoreTask, reorderTasks, isLoading } =
    tasksSource ?? fallback;
  const [showSkeleton, setShowSkeleton] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setShowSkeleton(false);
      return;
    }
    const t = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
    return () => clearTimeout(t);
  }, [isLoading]);

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
  const { getList } = useListsFromDashboard();

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

  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowClick = useCallback(
    (taskId: string) => {
      if (!onSelectTask || mode !== "default") return;
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        onSelectTask(taskId);
      }, CLICK_DELAY_MS);
    },
    [onSelectTask, mode]
  );

  const handleRowDoubleClick = useCallback(
    (task: Task) => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      if (mode === "default" && !task.completed) handleEditStart(task);
    },
    [mode, handleEditStart]
  );

  const renderTaskItem = (task: Task) => {
    const isEditing = editingId === task.id;
    const isHovered = hoverId === task.id;
    const isSelected = selectedId === task.id;

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
          (isHovered || isSelected) && "bg-muted/50",
          isSelected && "bg-muted/70"
        )}
        onMouseEnter={() => setHoverId(task.id)}
        onMouseLeave={() => setHoverId(null)}
        onClick={() => handleRowClick(task.id)}
        onDoubleClick={() => handleRowDoubleClick(task)}
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
        {mode !== "default" && task.owner === "human" && (
          <span className="shrink-0 inline-flex" title={OWNER_LABEL.human} aria-label={OWNER_LABEL.human}>
            <User className="size-3.5 text-muted-foreground" />
          </span>
        )}
        {mode !== "default" && task.owner === "agent" && (
          <span className="shrink-0 inline-flex" title={OWNER_LABEL.agent} aria-label={OWNER_LABEL.agent}>
            <Bot className="size-3.5 text-muted-foreground" />
          </span>
        )}
        {mode === "default" && (
          <>
            {showListName && task.listId && (
              <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground bg-muted/50">
                {getList(task.listId)?.name ?? "·"}
              </span>
            )}
            {task.owner === "human" && (
              <span className="shrink-0 inline-flex" title={OWNER_LABEL.human} aria-label={OWNER_LABEL.human}>
                <User className="size-3.5 text-muted-foreground" />
              </span>
            )}
            {task.owner === "agent" && (
              <span className="shrink-0 inline-flex" title={OWNER_LABEL.agent} aria-label={OWNER_LABEL.agent}>
                <Bot className="size-3.5 text-muted-foreground" />
              </span>
            )}
            <DateTimePickerPopover
              value={task.dueDate ?? null}
              onChange={(v) => updateTask(task.id, { dueDate: v })}
              open={editingDueDateId === task.id}
              onOpenChange={(open) => setEditingDueDateId(open ? task.id : null)}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "shrink-0 h-auto rounded px-1.5 py-0.5 text-xs text-muted-foreground bg-muted/60 hover:bg-muted/80",
                  !task.dueDate && "invisible min-w-[5rem]"
                )}
                aria-label="设置截止日期"
              >
                {task.dueDate ? formatDueDate(task.dueDate) : "\u200B"}
              </Button>
            }
            />
          </>
        )}
      </div>
        </ContextMenuTrigger>
        {contextMenuContent}
      </ContextMenu>
    );
  };

  const setOwnerFilter = useCallback(
    (value: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) {
          next.delete("owner");
        } else {
          next.set("owner", value);
        }
        return next;
      });
    },
    [setSearchParams]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 pl-7">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          {mode === "default" && (
            <div className="flex rounded-md border border-input bg-muted/30 p-0.5" role="tablist" aria-label="按创建者筛选">
              {OWNER_FILTER_OPTIONS.map(({ value, label }) => {
                const isActive = currentOwner === value;
                return (
                  <button
                    key={value ?? "all"}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setOwnerFilter(value)}
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                      isActive ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
        {showSkeleton ? (
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
                  isSelected={selectedId === task.id}
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
                  onSelectTask={onSelectTask}
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
