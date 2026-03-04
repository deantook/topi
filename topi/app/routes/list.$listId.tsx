import { useParams } from "react-router";
import { useCustomLists } from "@/hooks/use-custom-lists";
import { TaskList } from "@/components/task-list";

export function meta() {
  return [
    { title: "清单" },
    { name: "description", content: "自定义清单" },
  ];
}

export default function ListPage() {
  const { listId } = useParams<"listId">();
  const { getList } = useCustomLists();
  const list = listId ? getList(listId) : null;

  if (!listId) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">清单</h2>
        <p className="text-muted-foreground">未找到该清单。</p>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">清单</h2>
        <p className="text-muted-foreground">该清单不存在或已被删除。</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <TaskList
        title={list.name}
        filter={{ listId }}
      />
    </div>
  );
}
