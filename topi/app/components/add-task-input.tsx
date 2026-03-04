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
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={() => {
          setTimeout(() => setIsFocused(false), 0);
        }}
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
