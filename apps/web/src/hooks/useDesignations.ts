import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/designations";
import type { UpsertDesignationBody } from "@dj-assistant/types";

export function useDesignations() {
  return useQuery({ queryKey: ["designations"], queryFn: api.getDesignations });
}

export function useUpsertDesignation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertDesignationBody) => api.upsertDesignation(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["designations"] }),
  });
}

export function useDeleteDesignation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteDesignation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["designations"] }),
  });
}
