"use client";

import { useState, useCallback, useRef } from "react";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { TaskFilter, TaskPriority } from "@/hooks/use-tasks";
import { PRIORITY_LABEL } from "@/lib/task-constants";
import { cn } from "@/lib/utils";

const HH_MM_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function isValidTime(value: string): boolean {
  return HH_MM_REGEX.test(value) || value === "";
}

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
          "flex items-center gap-2 rounded-lg border border-gray-200 bg-muted/30 pl-3 pr-3 py-2 dark:border-gray-700"
        )}
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={handleBlurCapture}
      >
        <Plus className="size-4 shrink-0 text-muted-foreground text-[rgba(0,0,0,1)]" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="添加任务"
          className="h-8 flex-1 min-w-0 border-0 bg-transparent px-0 shadow-none text-[rgba(143,146,168,1)] placeholder:text-muted-foreground focus-visible:ring-0"
        />
        {showRightControls && !hideDatePicker && (
          <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="截止日期"
                className="shrink-0 text-muted-foreground"
              >
                {addDueDate ? (
                  <>
                    <span className="text-xs">
                      {formatDueDateForDisplay(addDueDate)}
                    </span>
                    <CalendarIcon className="size-3" />
                  </>
                ) : (
                  <CalendarIcon className="size-3" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent data-add-task-control align="start" className="w-auto p-0">
              <div className="flex flex-col gap-2 p-2">
                <Calendar
                  mode="single"
                  selected={
                    addDueDate
                      ? new Date(addDueDate.slice(0, 10))
                      : undefined
                  }
                  onSelect={(date: Date | undefined) => {
                    if (!date) return;
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, "0");
                    const d = String(date.getDate()).padStart(2, "0");
                    const timePart = addDueDate.length >= 16 ? addDueDate.slice(11, 16) : null;
                    if (timePart && isValidTime(timePart)) {
                      setAddDueDate(`${y}-${m}-${d} ${timePart}:00`);
                    } else {
                      setAddDueDate(`${y}-${m}-${d} 00:00:00`);
                    }
                  }}
                />
                <div className="flex items-center gap-2 border-t pt-2">
                  <Input
                    type="text"
                    placeholder="00:00"
                    value={
                      addDueDate && addDueDate.length >= 16
                        ? addDueDate.slice(11, 16)
                        : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      const datePart = addDueDate ? addDueDate.slice(0, 10) : null;
                      if (v === "") {
                        if (datePart) setAddDueDate(`${datePart} 00:00:00`);
                        return;
                      }
                      if (!isValidTime(v) || !datePart) return;
                      setAddDueDate(`${datePart} ${v}:00`);
                    }}
                    className="h-8 w-20"
                  />
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setAddDueDate("");
                      setDatePopoverOpen(false);
                    }}
                  >
                    清除
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
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
