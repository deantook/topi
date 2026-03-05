import type { Route } from "./+types/all";
import { TaskPageWithDetail } from "@/components/task-page-with-detail";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "待办清单" },
    { name: "description", content: "查看所有项目" },
  ];
}

export default function All() {
  return <TaskPageWithDetail title="所有" filter="all" />;
}
