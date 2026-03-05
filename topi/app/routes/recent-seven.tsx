import type { Route } from "./+types/recent-seven";
import { TaskPageWithDetail } from "@/components/task-page-with-detail";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "待办清单" },
    { name: "description", content: "最近七天的任务" },
  ];
}

export default function RecentSeven() {
  return <TaskPageWithDetail title="最近七天" filter="recent-seven" />;
}
