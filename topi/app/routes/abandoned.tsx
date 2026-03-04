import type { Route } from "./+types/abandoned";
import { TaskList } from "@/components/task-list";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "已放弃" },
    { name: "description", content: "已放弃的任务" },
  ];
}

export default function Abandoned() {
  return (
    <div className="max-w-2xl">
      <TaskList title="已放弃" filter="abandoned" mode="abandoned" />
    </div>
  );
}
