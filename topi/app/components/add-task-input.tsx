"use client";

import { useState, useCallback, useRef } from "react";
import { CalendarClock, Flag, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateTimePickerPopover } from "@/components/datetime-picker";
import { formatDueDateForDisplay } from "@/lib/date-utils";
import type { TaskFilter, TaskPriority } from "@/hooks/use-tasks";
import { PRIORITY_LABEL, PRIORITY_FLAG_CLASS } from "@/lib/task-constants";
import { cn } from "@/lib/utils";

export interface AddTaskInputProps {
  filter: TaskFilter;
  onSubmit: (
    text: string,
    options?: { listId?: string; dueDate?: string; priority?: TaskPriority }
  ) => void;
}

function isInsideAddTaskControl(el: Element | null): boolean {
  return !!el?.closest("[data-add-task-control]");
}

export function AddTaskInput({ filter, onSubmit }: AddTaskInputProps) {
  const [input, setInput] = useState("");
  const [addDueDate, setAddDueDate] = useState("");
  const [addPriority, setAddPriority] = useState<TaskPriority>("none");
  const [isFocused, setIsFocused] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const showRightControls =
    isFocused || !!addDueDate || addPriority !== "none";

  const hideDatePicker = filter === "today" || filter === "tomorrow";

  const handleBlurCapture = useCallback(() => {
    setTimeout(() => {
      const active = document.activeElement;
      const stillInContainer =
        containerRef.current?.contains(active as Node) ?? false;
      const stillInControl = isInsideAddTaskControl(active as Element);
      if (!stillInContainer && !stillInControl) {
        setIsFocused(false);
      }
    }, 0);
  }, []);

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
        ref={containerRef}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-background pl-3 pr-3 py-2"
        )}
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={handleBlurCapture}
      >
        <Plus className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="添加任务"
          className="h-8 flex-1 min-w-0 border-0 bg-transparent px-2 shadow-none text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
        />
        {showRightControls && (
          <div className="flex items-center gap-2 shrink-0">
        {!hideDatePicker && (
          <DateTimePickerPopover
            value={addDueDate || null}
            onChange={(v) => setAddDueDate(v ?? "")}
            trigger={
              <Button
                variant="ghost"
                size={addDueDate ? "xs" : "icon-sm"}
                aria-label="截止日期"
                className="shrink-0 text-muted-foreground gap-1.5"
              >
                {addDueDate ? (
                  <>
                    <span className="text-xs whitespace-nowrap">
                      {formatDueDateForDisplay(addDueDate)}
                    </span>
                    <CalendarClock className="size-4 shrink-0" />
                  </>
                ) : (
                  <CalendarClock className="size-4" />
                )}
              </Button>
            }
            open={datePopoverOpen}
            onOpenChange={setDatePopoverOpen}
            contentProps={{
              "data-add-task-control": true,
              className: "w-auto p-0 !bg-white dark:!bg-background",
            }}
          />
        )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="优先级"
                className={cn(
                  "shrink-0",
                  PRIORITY_FLAG_CLASS[addPriority]
                )}
              >
                <Flag
                  className={cn(
                    "size-4 transition-transform",
                    addPriority === "none" && "opacity-50"
                  )}
                  fill={addPriority === "none" ? "none" : "currentColor"}
                  strokeWidth={addPriority === "none" ? 1.5 : 2}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              data-add-task-control
              align="end"
              className="w-40"
            >
              <DropdownMenuLabel className="px-0 text-xs text-muted-foreground">
                优先级
              </DropdownMenuLabel>
              <div className="mt-1.5 flex gap-1 px-2">
                {(["high", "medium", "low", "none"] as const).map((p) => {
                  const isSelected = addPriority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAddPriority(p)}
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
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        )}
      </div>
    </form>
  );
}
