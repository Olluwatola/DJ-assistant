import { useMemo } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDesignations } from "./useDesignations";
import { useTrackDetailMode } from "./useTrackData";
import * as spotifyApi from "../api/spotify";
import { getPreviewUrls } from "../api/previewUrl";
import type { Track } from "@dj-assistant/types";

const STALE = 20 * 60 * 1000;

export function useLibrary() {
  const qc = useQueryClient();
  const { data: designations, isLoading: desLoading } = useDesignations();
  const { data: trackDetailMode } = useTrackDetailMode();

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
            previewUrl: t.previewUrl,
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

  // Song-box tracks that aren't in any base playlist — dropped from enrichedMap,
  // surfaced separately so they don't affect the core AND-filter hashmap
  const orphanMap = useMemo(() => {
    const map = new Map<string, Omit<Track, "audioFeatures"> & { audioFeatures: null }>();
    songBoxQueries.forEach((q, i) => {
      const pid = songBoxIds[i];
      q.data?.forEach((t) => {
        const key = `spotify:${t.id}`;
        if (rawMap.has(key)) return;
        const existing = map.get(key);
        if (existing) {
          if (!existing.playlistIds.includes(pid)) existing.playlistIds.push(pid);
        } else {
          map.set(key, {
            id: t.id,
            platform: "spotify",
            namespaceId: key,
            title: t.title,
            artist: t.artist,
            albumArt: t.albumArt,
            durationMs: t.durationMs,
            previewUrl: t.previewUrl,
            playlistIds: [pid],
            audioFeatures: null,
          });
        }
      });
    });
    return map;
  }, [rawMap, songBoxQueries, songBoxIds]);

  const allTrackIds = useMemo(
    () => [...enrichedMap.keys()].map((k) => k.split(":")[1]),
    [enrichedMap]
  );

  const trackLookups = useMemo(
    () => [...enrichedMap.values()].map((t) => ({ id: t.id, title: t.title, artist: t.artist })),
    [enrichedMap]
  );

  const orphanTrackIds = useMemo(
    () => [...orphanMap.keys()].map((k) => k.split(":")[1]),
    [orphanMap]
  );

  const orphanTrackLookups = useMemo(
    () => [...orphanMap.values()].map((t) => ({ id: t.id, title: t.title, artist: t.artist })),
    [orphanMap]
  );

  const allTrackLookups = useMemo(
    () => [...trackLookups, ...orphanTrackLookups],
    [trackLookups, orphanTrackLookups]
  );

  // Gated on every playlist-tracks query having settled, not just
  // allTrackLookups being non-empty - otherwise, with many designated playlists
  // resolving at different times, the track-id set (and therefore this query's
  // key) keeps growing as each one lands, restarting the slow sequential Deezer
  // fetch from scratch every time instead of letting one pass finish.
  const previewQuery = useQuery({
    queryKey: ["preview-urls", [...allTrackIds, ...orphanTrackIds].sort().join(",")],
    queryFn: () => getPreviewUrls(allTrackLookups),
    enabled:
      allTrackLookups.length > 0 &&
      !desLoading &&
      baseQueries.every((q) => !q.isLoading) &&
      songBoxQueries.every((q) => !q.isLoading),
    staleTime: Infinity,
  });

  const baseFeaturesQuery = useQuery({
    // Use a stable sorted copy for the key so it doesn't vary with insertion order
    queryKey: ["audio-features", "base", trackDetailMode, [...allTrackIds].sort().join(",")],
    queryFn: () => spotifyApi.getAudioFeatures(trackLookups, trackDetailMode!),
    enabled: trackLookups.length > 0 && trackDetailMode !== undefined,
    staleTime: Infinity,
  });
  const { data: audioFeaturesData, isLoading: featuresLoading } = baseFeaturesQuery;

  // Orphan BPM/key lookups must never race the real library's — only start once
  // the base fetch has settled (succeeded, errored, or had nothing to fetch)
  const baseFeaturesSettled =
    !baseFeaturesQuery.isFetching &&
    (baseFeaturesQuery.isSuccess || baseFeaturesQuery.isError || trackLookups.length === 0);

  // In "chosic" mode there's no automatic fallback at all, so orphaned tracks
  // (never covered by a manual, base-playlist-scoped chosic run) must never
  // be fetched — this query simply never runs in that mode.
  const orphanFeaturesQuery = useQuery({
    queryKey: ["audio-features", "orphan", trackDetailMode, [...orphanTrackIds].sort().join(",")],
    queryFn: () => spotifyApi.getAudioFeatures(orphanTrackLookups, trackDetailMode!),
    enabled:
      orphanTrackLookups.length > 0 &&
      baseFeaturesSettled &&
      trackDetailMode !== undefined &&
      trackDetailMode !== "chosic",
    staleTime: Infinity,
  });

  const tracks: Track[] = useMemo(() => {
    const featureMap = new Map(audioFeaturesData?.map((f) => [f.trackId, f]) ?? []);
    return [...enrichedMap.values()].map((t) => ({
      ...t,
      audioFeatures: featureMap.get(t.id) ?? null,
      previewUrl: previewQuery.data?.get(t.id) ?? t.previewUrl,
    }));
  }, [enrichedMap, audioFeaturesData, previewQuery.data]);

  const orphanedTracks: Track[] = useMemo(() => {
    const featureMap = new Map(orphanFeaturesQuery.data?.map((f) => [f.trackId, f]) ?? []);
    return [...orphanMap.values()].map((t) => ({
      ...t,
      audioFeatures: featureMap.get(t.id) ?? null,
      previewUrl: previewQuery.data?.get(t.id) ?? t.previewUrl,
    }));
  }, [orphanMap, orphanFeaturesQuery.data, previewQuery.data]);

  const isLoading =
    desLoading ||
    baseQueries.some((q) => q.isLoading) ||
    songBoxQueries.some((q) => q.isLoading);

  // True while the batch audio-features request is in flight
  const isFeaturesLoading = allTrackIds.length > 0 && featuresLoading;

  // True while the deferred orphan audio-features request is in flight
  const isOrphanFeaturesLoading = orphanTrackIds.length > 0 && orphanFeaturesQuery.isLoading;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["playlist-tracks"] });
    // Prefix-matches both ["audio-features","base",...] and ["audio-features","orphan",...]
    qc.invalidateQueries({ queryKey: ["audio-features"] });
  }

  return { tracks, isLoading, isFeaturesLoading, orphanedTracks, isOrphanFeaturesLoading, refresh };
}
