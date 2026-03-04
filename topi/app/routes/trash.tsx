import type { Route } from "./+types/trash";
import { TaskList } from "@/components/task-list";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "垃圾桶" },
    { name: "description", content: "已删除的项目" },
  ];
}

export default function Trash() {
  return (
    <div className="max-w-2xl">
      <TaskList title="垃圾桶" filter="trash" mode="trash" showAddInput={false} />
    </div>
  );
}
