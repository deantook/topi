import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";

export type TaskStatus = "active" | "completed" | "abandoned" | "trash";

export type TaskPriority = "none" | "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  listId: string | null;
  dueDate: string | null; // ISO date string
  priority: TaskPriority;
  status: TaskStatus;
  order: number;
  createdAt: string; // ISO string
}

/** API response task (snake_case) */
interface ApiTask {
  id: string;
  title: string;
  completed: boolean;
  list_id: string | null;
  due_date: string | null;
  priority?: string;
  status: TaskStatus;
  sort_order: number;
  created_at: string;
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
  return {
    id: r.id,
    title: r.title,
    completed: r.completed,
    listId: r.list_id ?? null,
    dueDate: r.due_date ?? null,
    priority,
    status: r.status,
    order: r.sort_order ?? 0,
    createdAt: r.created_at,
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

function filterToQuery(filter: TaskFilter, refDate: Date): Record<string, string> {
  if (typeof filter === "object" && "listId" in filter) {
    return { listId: filter.listId };
  }
  const params: Record<string, string> = { filter: String(filter) };
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

export function useTasks(filter: TaskFilter) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const filterKey =
    typeof filter === "object" && filter !== null && "listId" in filter
      ? `list:${filter.listId}`
      : String(filter);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = filterToQuery(filter, new Date());
      const query = new URLSearchParams(params).toString();
      const path = query ? `/tasks?${query}` : "/tasks";
      const res = (await apiClient.get(path)) as { data: ApiTask[] };
      const mapped = (res.data ?? []).map(mapTask);
      setTasks(mapped);
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredTasks = filterTasks(tasks, filter, new Date());

  const addTask = useCallback(
    async (
      title: string,
      options?: { listId?: string; dueDate?: string; priority?: TaskPriority }
    ) => {
      const body: {
        title: string;
        listId?: string;
        dueDate?: string;
        priority?: string;
      } = {
        title: title.trim() || "新任务",
      };
      if (options?.listId) body.listId = options.listId;
      if (options?.dueDate) body.dueDate = options.dueDate;
      if (options?.priority) body.priority = options.priority;
      try {
        const res = (await apiClient.post("/tasks", body)) as { data: ApiTask };
        if (res?.data) {
          const newTask = mapTask(res.data);
          setTasks((prev) => [...prev, newTask]);
          return newTask.id;
        }
        return "";
      } catch (e) {
        console.error("Failed to add task:", e);
        return "";
      }
    },
    []
  );

  const toggleTask = useCallback(async (id: string) => {
    try {
      await apiClient.post(`/tasks/${id}/toggle`);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                completed: !t.completed,
                status: t.completed ? ("active" as const) : ("completed" as const),
              }
            : t
        )
      );
    } catch (e) {
      console.error("Failed to toggle task:", e);
      fetchTasks();
    }
  }, [fetchTasks]);

  const updateTask = useCallback(
    async (
      id: string,
      updates: Partial<Pick<Task, "title" | "dueDate" | "listId" | "priority">>
    ) => {
      const body: Record<string, string | null> = {};
      if (updates.title !== undefined) body.title = updates.title;
      if (updates.listId !== undefined) body.listId = updates.listId;
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
      if (Object.keys(body).length === 0) return;
      try {
        await apiClient.patch(`/tasks/${id}`, body);
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
        );
      } catch (e) {
        console.error("Failed to update task:", e);
        fetchTasks();
      }
    },
    [fetchTasks]
  );

  const deleteTask = useCallback(
    async (id: string, permanent = false) => {
      try {
        if (permanent) {
          await apiClient.delete(`/tasks/${id}`);
        } else {
          await apiClient.post(`/tasks/${id}/trash`);
        }
        setTasks((prev) => prev.filter((t) => t.id !== id));
      } catch (e) {
        console.error("Failed to delete task:", e);
        fetchTasks();
      }
    },
    [fetchTasks]
  );

  const abandonTask = useCallback(async (id: string) => {
    try {
      await apiClient.post(`/tasks/${id}/abandon`);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: "abandoned" as const } : t
        )
      );
    } catch (e) {
      console.error("Failed to abandon task:", e);
      fetchTasks();
    }
  }, [fetchTasks]);

  const restoreTask = useCallback(async (id: string) => {
    try {
      await apiClient.post(`/tasks/${id}/restore`);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, status: "active" as const, completed: false }
            : t
        )
      );
    } catch (e) {
      console.error("Failed to restore task:", e);
      fetchTasks();
    }
  }, [fetchTasks]);

  const reorderTasks = useCallback(
    async (id: string, newIndex: number) => {
      const idx = filteredTasks.findIndex((t) => t.id === id);
      if (idx < 0 || idx === newIndex) return;
      try {
        await apiClient.post("/tasks/reorder", { id, newIndex });
        const reordered = [...filteredTasks];
        const [removed] = reordered.splice(idx, 1);
        reordered.splice(newIndex, 0, removed);
        setTasks((prev) =>
          prev.map((t) => {
            const i = reordered.findIndex((r) => r.id === t.id);
            return i >= 0 ? { ...t, order: i } : t;
          })
        );
      } catch (e) {
        console.error("Failed to reorder tasks:", e);
        fetchTasks();
      }
    },
    [filteredTasks, fetchTasks]
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
