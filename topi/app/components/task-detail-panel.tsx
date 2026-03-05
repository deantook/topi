"use client";

import { Suspense, lazy } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Task } from "@/hooks/use-tasks";

const TaskDetailEditor = lazy(() =>
  import("./task-detail-editor").then((m) => ({ default: m.TaskDetailEditor }))
);

export interface TaskDetailPanelProps {
  taskId: string | null;
  task: Task | null;
  onClose?: () => void;
  onSaveDetail: (id: string, detail: string) => void;
}

const EmptyState = () => (
  <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
    点击左侧任务查看或编辑详情
  </div>
);

function TaskDetailContent({
  task,
  onSaveDetail,
}: {
  task: Task;
  onSaveDetail: (id: string, detail: string) => void;
}) {
  return (
    <>
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="text-base">{task.title}</CardTitle>
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

export function TaskDetailPanel({ taskId, task, onClose, onSaveDetail }: TaskDetailPanelProps) {
  const isMobile = useIsMobile();

  const content =
    taskId == null ? (
      <EmptyState />
    ) : task ? (
      <TaskDetailContent task={task} onSaveDetail={onSaveDetail} />
    ) : (
      <EmptyState />
    );

  if (isMobile) {
    return (
      <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose?.()}>
        <SheetContent side="right" className="flex flex-col overflow-auto sm:max-w-md">
          <SheetHeader className="shrink-0">
            <SheetTitle>{task?.title ?? "任务详情"}</SheetTitle>
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
        <Card className="flex h-full flex-col overflow-hidden">
          <TaskDetailContent task={task} onSaveDetail={onSaveDetail} />
        </Card>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
