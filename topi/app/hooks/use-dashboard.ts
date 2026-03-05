import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface DashboardCounts {
  all: number;
  today: number;
  tomorrow: number;
  recentSeven: number;
  inbox: number;
  completed: number;
  abandoned: number;
  trash: number;
  list: Record<string, number>;
}

export interface DashboardList {
  id: string;
  name: string;
}

export interface DashboardData {
  counts: DashboardCounts;
  lists: DashboardList[];
}

const defaultCounts: DashboardCounts = {
  all: 0,
  today: 0,
  tomorrow: 0,
  recentSeven: 0,
  inbox: 0,
  completed: 0,
  abandoned: 0,
  trash: 0,
  list: {},
};

async function fetchDashboard(): Promise<DashboardData> {
  const res = (await apiClient.get("/dashboard")) as { data: DashboardData };
  return res.data ?? { counts: defaultCounts, lists: [] };
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });
}

export function useInvalidateDashboard() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}
