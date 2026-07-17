import client from "./client";
import type {
  AudioFeatures,
  TrackDetailMode,
  ChosicRunRequest,
  ChosicRunResult,
  MissingTrackData,
} from "@dj-assistant/types";

export async function getTrackDetailMode(): Promise<TrackDetailMode> {
  const { data } = await client.get<{ mode: TrackDetailMode }>("/track-data/settings");
  return data.mode;
}

export async function setTrackDetailMode(mode: TrackDetailMode): Promise<TrackDetailMode> {
  const { data } = await client.put<{ mode: TrackDetailMode }>("/track-data/settings", { mode });
  return data.mode;
}

export async function getCachedAudioFeatures(ids: string[]): Promise<AudioFeatures[]> {
  if (ids.length === 0) return [];
  const { data } = await client.get<AudioFeatures[]>("/track-data/cache", {
    params: { ids: ids.join(",") },
  });
  return data;
}

export async function getMissingTrackData(): Promise<MissingTrackData[]> {
  const { data } = await client.get<MissingTrackData[]>("/track-data/missing");
  return data;
}

export async function runChosicFetch(playlistIds: string[]): Promise<ChosicRunResult> {
  const body: ChosicRunRequest = { playlistIds };
  const { data } = await client.post<ChosicRunResult>("/track-data/chosic-run", body);
  return data;
}
