import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useDashboard } from "./use-dashboard";

export interface CustomList {
  id: string;
  name: string;
}

export function useListsFromDashboard() {
  const { data, isLoading } = useDashboard();
  const queryClient = useQueryClient();
  const lists: CustomList[] = data?.lists ?? [];

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient]);

  const addList = useCallback(
    async (name: string) => {
      const trimmed = name.trim() || "新清单";
      const res = (await apiClient.post("/lists", { name: trimmed })) as {
        data: CustomList;
      };
      invalidate();
      return res.data.id;
    },
    [invalidate]
  );

  const updateList = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      await apiClient.patch(`/lists/${id}`, { name: trimmed });
      invalidate();
    },
    [invalidate]
  );

  const deleteList = useCallback(
    async (id: string) => {
      await apiClient.delete(`/lists/${id}`);
      invalidate();
    },
    [invalidate]
  );

  const getList = useCallback(
    (id: string) => lists.find((l) => l.id === id),
    [lists]
  );

  return { lists, addList, updateList, deleteList, getList, isLoading };
}
