import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export type TaskStatus = "active" | "completed" | "abandoned" | "trash";

export type TaskPriority = "none" | "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  listId: string | null;
  dueDate: string | null; // ISO date string
  detail: string | null; // Markdown
  priority: TaskPriority;
  status: TaskStatus;
  order: number;
  createdAt: string; // ISO string
  owner: "human" | "agent" | null;
  estimatedHours: number | null;
}

/** API response task (snake_case) */
interface ApiTask {
  id: string;
  title: string;
  completed: boolean;
  list_id: string | null;
  due_date: string | null;
  detail?: string | null;
  priority?: string;
  status: TaskStatus;
  sort_order: number;
  created_at: string;
  owner?: string | null;
  estimated_hours?: number | null;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

function mapTask(r: ApiTask): Task {
  const p = r.priority as TaskPriority | undefined;
  const priority: TaskPriority =
    p === "none" || p === "low" || p === "medium" || p === "high" ? p : "none";
  const rawOwner = r.owner;
  const owner: "human" | "agent" | null =
    rawOwner === "human" || rawOwner === "agent" ? rawOwner : null;
  const estimatedHours =
    typeof r.estimated_hours === "number" && r.estimated_hours >= 1
      ? r.estimated_hours
      : null;
  return {
    id: r.id,
    title: r.title,
    completed: r.completed,
    listId: r.list_id ?? null,
    dueDate: r.due_date ?? null,
    detail: r.detail ?? null,
    priority,
    status: r.status,
    order: r.sort_order ?? 0,
    createdAt: r.created_at,
    owner,
    estimatedHours,
  };
}

export type TaskFilter =
  | "all"
  | "today"
  | "tomorrow"
  | "recent-seven"
  | "inbox"
  | { listId: string }
  | "completed"
  | "abandoned"
  | "trash";

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function filterToQuery(
  filter: TaskFilter,
  refDate: Date,
  owner?: string
): Record<string, string> {
  let params: Record<string, string>;
  if (typeof filter === "object" && "listId" in filter) {
    params = { listId: filter.listId };
  } else {
    params = { filter: String(filter) };
    if (filter === "today" || filter === "tomorrow") {
      const d = new Date(refDate);
      if (filter === "tomorrow") d.setDate(d.getDate() + 1);
      params.date = toLocalDateStr(d);
    } else if (filter === "recent-seven") {
      const today = new Date(refDate);
      today.setHours(0, 0, 0, 0);
      const start = toLocalDateStr(today);
      const end = new Date(today);
      end.setDate(end.getDate() + 6);
      params.startDate = start;
      params.endDate = toLocalDateStr(end);
    }
  }
  if (owner === "human" || owner === "agent") params.owner = owner;
  return params;
}

function isoDate(d: Date): string {
  return toLocalDateStr(d);
}

function isSameDay(a: string | null, b: string): boolean {
  return a !== null && a.slice(0, 10) === b;
}

function isInNext7Days(dateStr: string | null, from: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr.replace(" ", "T"));
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  d.setHours(0, 0, 0, 0);
  return d >= today && d < weekEnd;
}

function filterTasks(tasks: Task[], filter: TaskFilter, refDate: Date): Task[] {
  const today = isoDate(refDate);
  const tomorrow = isoDate(
    new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + 1)
  );

  let filtered: Task[];
  switch (filter) {
    case "all":
      filtered = tasks.filter((t) => t.status === "active");
      break;
    case "today":
      filtered = tasks.filter(
        (t) => t.status === "active" && isSameDay(t.dueDate, today)
      );
      break;
    case "tomorrow":
      filtered = tasks.filter(
        (t) =>
          t.status === "active" && isSameDay(t.dueDate, tomorrow)
      );
      break;
    case "recent-seven":
      filtered = tasks.filter(
        (t) => t.status === "active" && isInNext7Days(t.dueDate, refDate)
      );
      break;
    case "inbox":
      filtered = tasks.filter(
        (t) => t.status === "active" && !t.listId && !t.dueDate
      );
      break;
    case "completed":
      filtered = tasks.filter((t) => t.status === "completed");
      break;
    case "abandoned":
      filtered = tasks.filter((t) => t.status === "abandoned");
      break;
    case "trash":
      filtered = tasks.filter((t) => t.status === "trash");
      break;
    default:
      if (typeof filter === "object" && "listId" in filter) {
        filtered = tasks.filter(
          (t) => t.status === "active" && t.listId === filter.listId
        );
      } else {
        filtered = [];
      }
  }

  return [...filtered].sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.order - b.order
  );
}

export function useTasks(filter: TaskFilter, options?: { owner?: string }) {
  const queryClient = useQueryClient();

  const filterKey =
    typeof filter === "object" && filter !== null && "listId" in filter
      ? `list:${filter.listId}`
      : String(filter);
  const ownerKey = options?.owner ?? "";

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", filterKey, ownerKey],
    queryFn: async () => {
      const params = filterToQuery(filter, new Date(), options?.owner);
      const query = new URLSearchParams(params).toString();
      const path = query ? `/tasks?${query}` : "/tasks";
      const res = (await apiClient.get(path)) as { data: ApiTask[] };
      return (res.data ?? []).map(mapTask);
    },
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient]);

  const filteredTasks = filterTasks(tasks, filter, new Date());

  const addTask = useCallback(
    async (
      title: string,
      options?: {
        listId?: string;
        dueDate?: string;
        priority?: TaskPriority;
        estimatedHours?: number;
      }
    ) => {
      const body: {
        title: string;
        listId?: string;
        dueDate?: string;
        priority?: string;
        estimated_hours?: number;
        owner: "human";
      } = {
        title: title.trim() || "新任务",
        owner: "human",
      };
      if (options?.listId) body.listId = options.listId;
      if (options?.dueDate) body.dueDate = options.dueDate;
      if (options?.priority) body.priority = options.priority;
      if (options?.estimatedHours != null && options.estimatedHours >= 1) {
        body.estimated_hours = options.estimatedHours;
      }
      try {
        const res = (await apiClient.post("/tasks", body)) as { data: ApiTask };
        if (res?.data) {
          invalidate();
          return mapTask(res.data).id;
        }
        return "";
      } catch (e) {
        console.error("Failed to add task:", e);
        return "";
      }
    },
    [invalidate]
  );

  const toggleTask = useCallback(
    async (id: string) => {
      try {
        await apiClient.post(`/tasks/${id}/toggle`);
        invalidate();
      } catch (e) {
        console.error("Failed to toggle task:", e);
      }
    },
    [invalidate]
  );

  const updateTask = useCallback(
    async (
      id: string,
      updates: Partial<
        Pick<
          Task,
          "title" | "dueDate" | "listId" | "priority" | "detail" | "owner" | "estimatedHours"
        >
      >
    ) => {
      const body: Record<string, string | number | boolean | null> = {};
      if (updates.title !== undefined) body.title = updates.title;
      if (updates.listId !== undefined) body.listId = updates.listId;
      if (updates.detail !== undefined) body.detail = updates.detail;
      if (updates.dueDate !== undefined) {
        const d = updates.dueDate ?? "";
        body.dueDate = d
          ? d.includes("T")
            ? d.replace("T", " ").slice(0, 16) + ":00"
            : d.length === 10
              ? d + " 00:00:00"
              : d.length >= 19
                ? d.slice(0, 19)
                : d
          : "";
      }
      if (updates.priority !== undefined) body.priority = updates.priority;
      if (updates.owner !== undefined) body.owner = updates.owner;
      if (updates.estimatedHours !== undefined) {
        if (updates.estimatedHours != null && updates.estimatedHours >= 1) {
          body.estimated_hours = updates.estimatedHours;
        } else {
          body.clear_estimated_hours = true;
        }
      }
      if (Object.keys(body).length === 0) return;
      try {
        await apiClient.patch(`/tasks/${id}`, body);
        invalidate();
      } catch (e) {
        console.error("Failed to update task:", e);
      }
    },
    [invalidate]
  );

  const deleteTask = useCallback(
    async (id: string, permanent = false) => {
      try {
        if (permanent) {
          await apiClient.delete(`/tasks/${id}`);
        } else {
          await apiClient.post(`/tasks/${id}/trash`);
        }
        invalidate();
      } catch (e) {
        console.error("Failed to delete task:", e);
      }
    },
    [invalidate]
  );

  const abandonTask = useCallback(
    async (id: string) => {
      try {
        await apiClient.post(`/tasks/${id}/abandon`);
        invalidate();
      } catch (e) {
        console.error("Failed to abandon task:", e);
      }
    },
    [invalidate]
  );

  const restoreTask = useCallback(
    async (id: string) => {
      try {
        await apiClient.post(`/tasks/${id}/restore`);
        invalidate();
      } catch (e) {
        console.error("Failed to restore task:", e);
      }
    },
    [invalidate]
  );

  const reorderTasks = useCallback(
    async (id: string, newIndex: number) => {
      const idx = filteredTasks.findIndex((t) => t.id === id);
      if (idx < 0 || idx === newIndex) return;
      try {
        await apiClient.post("/tasks/reorder", { id, newIndex });
        invalidate();
      } catch (e) {
        console.error("Failed to reorder tasks:", e);
      }
    },
    [filteredTasks, invalidate]
  );

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    abandonTask,
    restoreTask,
    reorderTasks,
    isLoading,
  };
}

