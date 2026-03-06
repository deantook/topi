"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskSearch } from "@/hooks/use-task-search";
import { useListsFromDashboard } from "@/hooks/use-lists-from-dashboard";
import type { Task } from "@/hooks/use-tasks";

const DEBOUNCE_MS = 250;

function getTaskTargetUrl(task: Task): string {
  const base = task.listId ? `/list/${task.listId}` : "/inbox";
  return `${base}?selected=${task.id}`;
}

function formatDueDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const datePart = dateStr.slice(0, 10);
  return datePart; // YYYY-MM-DD
}

export interface TaskSearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskSearchCommand({ open, onOpenChange }: TaskSearchCommandProps) {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const { getList } = useListsFromDashboard();
  const { data: tasks = [], isLoading, isFetching, isError, refetch } = useTaskSearch(debouncedQ, open);

  useEffect(() => {
    if (!open) {
      setInputValue("");
      setDebouncedQ("");
      return;
    }
    const t = setTimeout(() => {
      setDebouncedQ(inputValue.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [inputValue, open]);

  const handleSelect = (task: Task) => {
    const url = getTaskTargetUrl(task);
    navigate(url);
    onOpenChange(false);
    setInputValue("");
  };

  const trimmedInput = inputValue.trim();
  const hasQuery = debouncedQ.length > 0;
  const showEmptyInput = !trimmedInput && !hasQuery && !isError;
  const showNoResults = hasQuery && !isLoading && !isFetching && !isError && tasks.length === 0;
  const showError = hasQuery && isError;
  const showLoading = (isLoading || isFetching) && hasQuery;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>搜索任务</DialogTitle>
          <DialogDescription>输入关键词搜索任务</DialogDescription>
        </DialogHeader>
        <Command
          shouldFilter={false}
          className="flex h-full w-full flex-col overflow-hidden rounded-md [&_[data-slot=command-input-wrapper]]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0"
        >
        <CommandInput
          placeholder="搜索任务…"
          value={inputValue}
          onValueChange={setInputValue}
        />
        <CommandList>
          {showEmptyInput && (
            <CommandEmpty>输入关键词搜索</CommandEmpty>
          )}
          {showNoResults && (
            <CommandEmpty>未找到相关任务</CommandEmpty>
          )}
          {showError && (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
              <span>搜索失败，请重试</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-primary underline underline-offset-4 hover:no-underline"
              >
                重试
              </button>
            </div>
          )}
          {showLoading && (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
          {!showEmptyInput && !showNoResults && !showError && !showLoading && tasks.length > 0 && (
            <CommandGroup heading="任务">
              {tasks.map((task) => {
                const listName = task.listId
                  ? (getList(task.listId)?.name ?? "已删除的清单")
                  : "收集箱";
                const displayList = listName;
                const dueStr = formatDueDate(task.dueDate);

                return (
                  <CommandItem
                    key={task.id}
                    value={task.id}
                    onSelect={() => handleSelect(task)}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{task.title}</span>
                        {task.completed && (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            已完成
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{displayList}</span>
                        {dueStr && <span>· {dueStr}</span>}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </DialogContent>
    </Dialog>
  );
}
