import type { Route } from "./+types/recent-seven";
import { TaskList } from "@/components/task-list";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "待办清单" },
    { name: "description", content: "最近七天的任务" },
  ];
}

export default function RecentSeven() {
  return (
    <div className="max-w-2xl">
      <TaskList title="最近七天" filter="recent-seven" />
    </div>
  );
}
