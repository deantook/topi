import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";

export interface CustomList {
  id: string;
  name: string;
}

type ApiList = { id: string; name: string };

function mapList(r: ApiList): CustomList {
  return { id: r.id, name: r.name };
}

export function useCustomLists() {
  const [lists, setLists] = useState<CustomList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLists = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = (await apiClient.get("/lists")) as { data: ApiList[] };
      setLists((res.data ?? []).map(mapList));
    } catch {
      setLists([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const addList = useCallback(
    async (name: string) => {
      const trimmed = name.trim() || "新清单";
      const res = (await apiClient.post("/lists", { name: trimmed })) as {
        data: ApiList;
      };
      const newList = mapList(res.data);
      setLists((prev) => [...prev, newList]);
      return newList.id;
    },
    []
  );

  const updateList = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await apiClient.patch(`/lists/${id}`, { name: trimmed });
    setLists((prev) =>
      prev.map((l) => (l.id === id ? { ...l, name: trimmed } : l))
    );
  }, []);

  const deleteList = useCallback(async (id: string) => {
    await apiClient.delete(`/lists/${id}`);
    setLists((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const getList = useCallback(
    (id: string) => lists.find((l) => l.id === id),
    [lists]
  );

  return { lists, addList, updateList, deleteList, getList, isLoading };
}
