import type { TaskPriority } from "@/hooks/use-tasks";

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
  none: "无",
};

export const PRIORITY_FLAG_CLASS: Record<TaskPriority, string> = {
  high: "text-red-500",
  medium: "text-blue-500",
  low: "text-muted-foreground",
  none: "text-muted-foreground/50",
};

export const PRIORITY_CHECKBOX_CLASS: Record<TaskPriority, string> = {
  high:
    "border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500",
  medium:
    "border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500",
  low:
    "border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:border-muted-foreground",
  none: "",
};
