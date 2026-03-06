import type { Route } from "./+types/inbox";
import { TaskPageWithDetail } from "@/components/task-page-with-detail";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "topi" },
    { name: "description", content: "待分类的收集项" },
  ];
}

export default function Inbox() {
  return <TaskPageWithDetail title="收集箱" filter="inbox" />;
}
