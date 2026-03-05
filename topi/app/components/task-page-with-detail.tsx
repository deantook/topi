"use client";

import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { TaskList } from "@/components/task-list";
import { TaskDetailPanel } from "@/components/task-detail-panel";
import { useTasks } from "@/hooks/use-tasks";
import type { TaskFilter } from "@/hooks/use-tasks";

export interface TaskPageWithDetailProps {
  title: string;
  filter: TaskFilter;
  showSort?: boolean;
  showAddInput?: boolean;
  mode?: "default" | "completed" | "abandoned" | "trash";
}

export function TaskPageWithDetail({
  title,
  filter,
  showSort = true,
  showAddInput = true,
  mode = "default",
}: TaskPageWithDetailProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("selected");
  const ownerParam = searchParams.get("owner");
  const owner = ownerParam === "human" || ownerParam === "agent" ? ownerParam : undefined;

  const tasksHook = useTasks(filter, { owner });
  const { tasks, updateTask } = tasksHook;
  const selectedTask = selectedId ? tasks.find((t) => t.id === selectedId) ?? null : null;

  const setSelected = (id: string | null) => {
    if (id) {
      setSearchParams({ selected: id });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="flex min-w-0 flex-1 gap-4">
      <div className="min-w-0 shrink-0 basis-[60rem] max-w-[70.56rem]">
        <TaskList
          title={title}
          filter={filter}
          showSort={showSort}
          showAddInput={showAddInput}
          mode={mode}
          selectedId={selectedId}
          onSelectTask={setSelected}
          tasksSource={tasksHook}
        />
      </div>
      <TaskDetailPanel
        taskId={selectedId}
        task={selectedTask}
        onClose={() => setSelected(null)}
        onSaveDetail={(id, detail) =>
          updateTask(id, { detail }).catch(() => {
            toast.error("保存失败，请重试");
          })
        }
        onUpdateOwner={(id, owner) =>
          updateTask(id, { owner }).catch(() => {
            toast.error("更新失败，请重试");
          })
        }
      />
    </div>
  );
}
