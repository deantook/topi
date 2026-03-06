import type { Route } from "./+types/dashboard";
import { TaskList } from "@/components/task-list";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "topi" },
    { name: "description", content: "应用仪表盘" },
  ];
}

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">仪表盘</h2>
      <TaskList title="所有任务" filter="all" />
    </div>
  );
}
