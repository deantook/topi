import type { Route } from "./+types/inbox";
import { TaskList } from "@/components/task-list";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "收集箱" },
    { name: "description", content: "待分类的收集项" },
  ];
}

export default function Inbox() {
  return (
    <div className="max-w-2xl">
      <TaskList title="收集箱" filter="inbox" />
    </div>
  );
}
