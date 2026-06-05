import { useState, useCallback } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import * as setsApi from "../api/sets";
import type { Track, SetTrack } from "@dj-assistant/types";

interface ActiveSetState {
  setId: string | null;
  name: string;
  tracks: SetTrack[];
  isDirty: boolean;
}

const DEFAULT_STATE: ActiveSetState = {
  setId: null,
  name: "New Set",
  tracks: [],
  isDirty: false,
};

export function useActiveSet() {
  const [state, setState] = useState<ActiveSetState>(DEFAULT_STATE);
  const qc = useQueryClient();

  const addTrack = useCallback((track: Track) => {
    setState((prev) => {
      // Prevent duplicates
      if (prev.tracks.some((t) => t.platformTrackId === track.id && t.platform === track.platform)) {
        return prev;
      }
      return {
        ...prev,
        tracks: [
          ...prev.tracks,
          {
            position: prev.tracks.length,
            platform: track.platform,
            platformTrackId: track.id,
            snapshotTitle: track.title,
            snapshotArtist: track.artist,
          },
        ],
        isDirty: true,
      };
    });
  }, []);

  const removeTrack = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      tracks: prev.tracks
        .filter((_, i) => i !== index)
        .map((t, i) => ({ ...t, position: i })),
      isDirty: true,
    }));
  }, []);

  const reorderTracks = useCallback((oldIndex: number, newIndex: number) => {
    setState((prev) => ({
      ...prev,
      tracks: arrayMove(prev.tracks, oldIndex, newIndex).map((t, i) => ({
        ...t,
        position: i,
      })),
      isDirty: true,
    }));
  }, []);

  const setName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, name, isDirty: true }));
  }, []);

  const save = useCallback(async () => {
    let setId = state.setId;

    if (!setId) {
      const created = await setsApi.createSet(state.name);
      setId = created._id;
    } else if (state.isDirty) {
      await setsApi.renameSet(setId, state.name);
    }

    await setsApi.patchSetTracks(setId, { tracks: state.tracks });
    qc.invalidateQueries({ queryKey: ["sets"] });

    setState((prev) => ({ ...prev, setId, isDirty: false }));
    return setId;
  }, [state, qc]);

  const loadSet = useCallback(async (id: string) => {
    const s = await setsApi.getSet(id);
    setState({
      setId: s._id,
      name: s.name,
      tracks: s.tracks,
      isDirty: false,
    });
  }, []);

  const clearSet = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  return {
    ...state,
    addTrack,
    removeTrack,
    reorderTracks,
    setName,
    save,
    loadSet,
    clearSet,
  };
}
