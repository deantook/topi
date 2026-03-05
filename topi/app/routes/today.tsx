import type { Route } from "./+types/today";
import { TaskList } from "@/components/task-list";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "待办清单" },
    { name: "description", content: "今日任务" },
  ];
}

export default function Today() {
  return (
    <div className="max-w-2xl">
      <TaskList title="今天" filter="today" />
    </div>
  );
}
