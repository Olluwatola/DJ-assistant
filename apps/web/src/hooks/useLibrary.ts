import { useMemo } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDesignations } from "./useDesignations";
import * as spotifyApi from "../api/spotify";
import type { Track } from "@dj-assistant/types";

const STALE = 20 * 60 * 1000;

export function useLibrary() {
  const qc = useQueryClient();
  const { data: designations, isLoading: desLoading } = useDesignations();

  const basePlaylistIds = useMemo(
    () => designations?.filter((d) => d.type === "base").map((d) => d.platformPlaylistId) ?? [],
    [designations]
  );

  const songBoxIds = useMemo(
    () => designations?.filter((d) => d.type === "song_box").map((d) => d.platformPlaylistId) ?? [],
    [designations]
  );

  const baseQueries = useQueries({
    queries: basePlaylistIds.map((pid) => ({
      queryKey: ["playlist-tracks", pid],
      queryFn: () => spotifyApi.getPlaylistTracks(pid),
      staleTime: STALE,
    })),
  });

  const songBoxQueries = useQueries({
    queries: songBoxIds.map((pid) => ({
      queryKey: ["playlist-tracks", pid],
      queryFn: () => spotifyApi.getPlaylistTracks(pid),
      staleTime: STALE,
    })),
  });

  // Build deduplicated hashmap from base playlists
  const rawMap = useMemo(() => {
    const map = new Map<string, Omit<Track, "audioFeatures"> & { audioFeatures: null }>();
    baseQueries.forEach((q, i) => {
      const pid = basePlaylistIds[i];
      q.data?.forEach((t) => {
        const key = `spotify:${t.id}`;
        const existing = map.get(key);
        if (existing) {
          existing.playlistIds.push(pid);
        } else {
          map.set(key, {
            id: t.id,
            platform: "spotify",
            namespaceId: key,
            title: t.title,
            artist: t.artist,
            albumArt: t.albumArt,
            durationMs: t.durationMs,
            playlistIds: [pid],
            audioFeatures: null,
          });
        }
      });
    });
    return map;
  }, [baseQueries, basePlaylistIds]);

  // Augment with song-box membership for tracks already in base playlists
  const enrichedMap = useMemo(() => {
    const m = new Map(rawMap);
    songBoxQueries.forEach((q, i) => {
      const pid = songBoxIds[i];
      q.data?.forEach((t) => {
        const key = `spotify:${t.id}`;
        const existing = m.get(key);
        if (existing && !existing.playlistIds.includes(pid)) {
          existing.playlistIds.push(pid);
        }
      });
    });
    return m;
  }, [rawMap, songBoxQueries, songBoxIds]);

  const allTrackIds = useMemo(
    () => [...enrichedMap.keys()].map((k) => k.split(":")[1]),
    [enrichedMap]
  );

  const trackLookups = useMemo(
    () => [...enrichedMap.values()].map((t) => ({ id: t.id, title: t.title, artist: t.artist })),
    [enrichedMap]
  );

  const { data: audioFeaturesData, isLoading: featuresLoading } = useQuery({
    // Use a stable sorted copy for the key so it doesn't vary with insertion order
    queryKey: ["audio-features", [...allTrackIds].sort().join(",")],
    queryFn: () => spotifyApi.getAudioFeatures(trackLookups),
    enabled: trackLookups.length > 0,
    staleTime: STALE,
  });

  const tracks: Track[] = useMemo(() => {
    const featureMap = new Map(audioFeaturesData?.map((f) => [f.trackId, f]) ?? []);
    return [...enrichedMap.values()].map((t) => ({
      ...t,
      audioFeatures: featureMap.get(t.id) ?? null,
    }));
  }, [enrichedMap, audioFeaturesData]);

  const isLoading =
    desLoading ||
    baseQueries.some((q) => q.isLoading) ||
    songBoxQueries.some((q) => q.isLoading);

  // True while the batch audio-features request is in flight
  const isFeaturesLoading = allTrackIds.length > 0 && featuresLoading;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["playlist-tracks"] });
    qc.invalidateQueries({ queryKey: ["audio-features"] });
  }

  return { tracks, isLoading, isFeaturesLoading, refresh };
}
