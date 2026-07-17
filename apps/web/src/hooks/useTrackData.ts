import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/trackData";
import type { TrackDetailMode } from "@dj-assistant/types";

export function useTrackDetailMode() {
  return useQuery({ queryKey: ["track-data", "settings"], queryFn: api.getTrackDetailMode });
}

export function useSetTrackDetailMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: TrackDetailMode) => api.setTrackDetailMode(mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["track-data", "settings"] });
      qc.invalidateQueries({ queryKey: ["audio-features"] });
    },
  });
}

export function useMissingTrackData() {
  return useQuery({ queryKey: ["track-data", "missing"], queryFn: api.getMissingTrackData });
}

export function useRunChosicFetch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playlistIds: string[]) => api.runChosicFetch(playlistIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["track-data", "missing"] });
      qc.invalidateQueries({ queryKey: ["audio-features"] });
    },
  });
}
