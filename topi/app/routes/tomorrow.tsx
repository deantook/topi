import type { Route } from "./+types/tomorrow";
import { TaskList } from "@/components/task-list";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "明天" },
    { name: "description", content: "明日任务" },
  ];
}

export default function Tomorrow() {
  return (
    <div className="max-w-2xl">
      <TaskList title="明天" filter="tomorrow" />
    </div>
  );
}
