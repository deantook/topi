import type { Route } from "./+types/completed";
import { TaskList } from "@/components/task-list";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "topi" },
    { name: "description", content: "已完成的任务" },
  ];
}

export default function Completed() {
  return (
    <div className="max-w-2xl">
      <TaskList title="已完成" filter="completed" mode="completed" />
    </div>
  );
}
