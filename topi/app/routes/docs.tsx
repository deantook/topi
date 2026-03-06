import type { Route } from "./+types/docs";
import { TaskList } from "@/components/task-list";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "topi" },
    { name: "description", content: "应用文档" },
  ];
}

export default function Docs() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">文档</h2>
      <TaskList title="待办" filter="all" />
    </div>
  );
}
