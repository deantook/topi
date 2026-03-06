import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Task } from "./use-tasks";

interface ApiTask {
  id: string;
  title: string;
  completed: boolean;
  list_id: string | null;
  due_date: string | null;
  priority?: string;
  status: string;
  sort_order: number;
  created_at: string;
  owner?: string | null;
  estimated_hours?: number | null;
}

function mapTask(r: ApiTask): Task {
  const priority = (r.priority === "high" || r.priority === "medium" || r.priority === "low" ? r.priority : "none") as Task["priority"];
  const owner = r.owner === "human" || r.owner === "agent" ? r.owner : null;
  return {
    id: r.id,
    title: r.title,
    completed: r.completed,
    listId: r.list_id ?? null,
    dueDate: r.due_date ?? null,
    detail: null,
    priority,
    status: r.status as Task["status"],
    order: r.sort_order ?? 0,
    createdAt: r.created_at,
    owner,
    estimatedHours: typeof r.estimated_hours === "number" && r.estimated_hours >= 1 ? r.estimated_hours : null,
  };
}

export function useTaskSearch(q: string, enabled: boolean) {
  const res = useQuery({
    queryKey: ["task-search", q],
    queryFn: async () => {
      const res = (await apiClient.get(`/tasks?q=${encodeURIComponent(q)}`)) as { data: ApiTask[] };
      return (res.data ?? []).map(mapTask);
    },
    enabled: enabled && q.trim().length > 0,
    staleTime: 10_000,
  });
  return res;
}
