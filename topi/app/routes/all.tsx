import type { Route } from "./+types/all";
import { TaskList } from "@/components/task-list";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "待办清单" },
    { name: "description", content: "查看所有项目" },
  ];
}

export default function All() {
  return (
    <div className="max-w-2xl">
      <TaskList title="所有" filter="all" />
    </div>
  );
}
