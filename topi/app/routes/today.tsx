import type { Route } from "./+types/today";
import { TaskPageWithDetail } from "@/components/task-page-with-detail";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "待办清单" },
    { name: "description", content: "今日任务" },
  ];
}

export default function Today() {
  return <TaskPageWithDetail title="今天" filter="today" />;
}
