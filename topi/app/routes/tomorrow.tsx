import type { Route } from "./+types/tomorrow";
import { TaskPageWithDetail } from "@/components/task-page-with-detail";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "topi" },
    { name: "description", content: "明日任务" },
  ];
}

export default function Tomorrow() {
  return <TaskPageWithDetail title="明天" filter="tomorrow" />;
}
