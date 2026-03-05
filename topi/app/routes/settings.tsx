import type { Route } from "./+types/settings";
import { TaskList } from "@/components/task-list";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "待办清单" },
    { name: "description", content: "应用设置" },
  ];
}

export default function Settings() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">设置</h2>
      <TaskList title="待办" filter="all" />
    </div>
  );
}
