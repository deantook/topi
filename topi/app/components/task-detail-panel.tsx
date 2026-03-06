"use client";

import { Suspense, lazy } from "react";
import { Bot, Clock, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Task } from "@/hooks/use-tasks";
import { OWNER_LABEL } from "@/lib/task-constants";

const TaskDetailEditor = lazy(() =>
  import("./task-detail-editor").then((m) => ({ default: m.TaskDetailEditor }))
);

export interface TaskDetailPanelProps {
  taskId: string | null;
  task: Task | null;
  onClose?: () => void;
  onSaveDetail: (id: string, detail: string) => void;
  onUpdateOwner?: (id: string, owner: "human" | "agent") => void;
  onUpdateEstimatedHours?: (id: string, estimatedHours: number | null) => void;
}

const EmptyState = () => (
  <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
    点击左侧任务查看或编辑详情
  </div>
);

const ESTIMATED_HOURS_OPTIONS = [1, 2, 3, 4, 5, 8] as const;

function TaskDetailContent({
  task,
  onSaveDetail,
  onUpdateOwner,
  onUpdateEstimatedHours,
}: {
  task: Task;
  onSaveDetail: (id: string, detail: string) => void;
  onUpdateOwner?: (id: string, owner: "human" | "agent") => void;
  onUpdateEstimatedHours?: (id: string, estimatedHours: number | null) => void;
}) {
  const ownerLabel = task.owner ? OWNER_LABEL[task.owner] : "未知";
  const OwnerIcon = task.owner === "agent" ? Bot : User;

  return (
    <>
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="text-base">{task.title}</CardTitle>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <OwnerIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{ownerLabel}</span>
          {onUpdateOwner && (
            <div className="ml-2 inline-flex rounded-md border border-input bg-muted/30 p-0.5">
              <Button
                variant={task.owner === "human" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => onUpdateOwner(task.id, "human")}
              >
                <User className="size-3" />
                {OWNER_LABEL.human}
              </Button>
              <Button
                variant={task.owner === "agent" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => onUpdateOwner(task.id, "agent")}
              >
                <Bot className="size-3" />
                {OWNER_LABEL.agent}
              </Button>
            </div>
          )}
          {onUpdateEstimatedHours && (
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">预估耗时</span>
              <div className="inline-flex rounded-md border border-input bg-muted/30 p-0.5">
                {ESTIMATED_HOURS_OPTIONS.map((h) => {
                  const isSelected = task.estimatedHours === h;
                  return (
                    <Button
                      key={h}
                      variant={isSelected ? "secondary" : "ghost"}
                      size="xs"
                      onClick={() =>
                        onUpdateEstimatedHours(task.id, isSelected ? null : h)
                      }
                    >
                      {h}h
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-auto pt-0">
        <Suspense fallback={<div className="min-h-[200px] animate-pulse rounded-md bg-muted/20" />}>
          <TaskDetailEditor
            value={task.detail ?? ""}
            onSave={(markdown) => onSaveDetail(task.id, markdown)}
            placeholder="添加任务详情..."
          />
        </Suspense>
      </CardContent>
    </>
  );
}

export function TaskDetailPanel({
  taskId,
  task,
  onClose,
  onSaveDetail,
  onUpdateOwner,
  onUpdateEstimatedHours,
}: TaskDetailPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    const ownerLabel = task?.owner ? OWNER_LABEL[task.owner] : "未知";
    const OwnerIcon = task?.owner === "agent" ? Bot : User;

    return (
      <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose?.()}>
        <SheetContent side="right" className="flex flex-col overflow-auto sm:max-w-md">
          <SheetHeader className="shrink-0">
            <SheetTitle>{task?.title ?? "任务详情"}</SheetTitle>
            {task && (
              <div className="flex flex-col gap-2 pt-2">
                <OwnerIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{ownerLabel}</span>
                {onUpdateOwner && (
                  <div className="ml-2 inline-flex rounded-md border border-input bg-muted/30 p-0.5">
                    <Button
                      variant={task.owner === "human" ? "secondary" : "ghost"}
                      size="xs"
                      onClick={() => onUpdateOwner(task.id, "human")}
                    >
                      <User className="size-3" />
                      {OWNER_LABEL.human}
                    </Button>
                    <Button
                      variant={task.owner === "agent" ? "secondary" : "ghost"}
                      size="xs"
                      onClick={() => onUpdateOwner(task.id, "agent")}
                    >
                      <Bot className="size-3" />
                      {OWNER_LABEL.agent}
                    </Button>
                  </div>
                )}
                {onUpdateEstimatedHours && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">预估耗时</span>
                    <div className="inline-flex rounded-md border border-input bg-muted/30 p-0.5">
                      {ESTIMATED_HOURS_OPTIONS.map((h) => {
                        const isSelected = task.estimatedHours === h;
                        return (
                          <Button
                            key={h}
                            variant={isSelected ? "secondary" : "ghost"}
                            size="xs"
                            onClick={() =>
                              onUpdateEstimatedHours(task.id, isSelected ? null : h)
                            }
                          >
                            {h}h
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </SheetHeader>
          <div className="flex-1 overflow-auto py-4">
            {task ? (
              <Suspense fallback={<div className="min-h-[200px] animate-pulse rounded-md bg-muted/20" />}>
                <TaskDetailEditor
                  value={task.detail ?? ""}
                  onSave={(markdown) => onSaveDetail(task.id, markdown)}
                  placeholder="添加任务详情..."
                />
              </Suspense>
            ) : (
              <EmptyState />
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {taskId == null ? (
        <EmptyState />
      ) : task ? (
        <Card className="flex h-full flex-col overflow-hidden shadow-none">
          <TaskDetailContent
            task={task}
            onSaveDetail={onSaveDetail}
            onUpdateOwner={onUpdateOwner}
            onUpdateEstimatedHours={onUpdateEstimatedHours}
          />
        </Card>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
