import client from "./client";
import type { Playlist, AudioFeatures, CreatePlaylistResponse, TrackDetailMode } from "@dj-assistant/types";

export interface SpotifyStatus {
  connected: boolean;
  spotifyUserId: string | null;
}

export interface RawTrack {
  id: string;
  title: string;
  artist: string;
  albumArt: string | null;
  durationMs: number;
}

export async function getStatus(): Promise<SpotifyStatus> {
  const { data } = await client.get<SpotifyStatus>("/spotify/status");
  return data;
}

export async function getPlaylists(): Promise<Playlist[]> {
  const { data } = await client.get<Playlist[]>("/spotify/playlists");
  return data;
}

export async function getPlaylistTracks(playlistId: string): Promise<RawTrack[]> {
  const { data } = await client.get<RawTrack[]>(`/spotify/playlists/${playlistId}/items`);
  return data;
}

export interface TrackLookup {
  id: string;
  title: string;
  artist: string;
}

export async function getAudioFeatures(
  tracks: TrackLookup[],
  mode: TrackDetailMode
): Promise<AudioFeatures[]> {
  const { getAudioFeaturesFromCache } = await import("./bpm");
  return getAudioFeaturesFromCache(tracks, mode);
}

export async function createPlaylistFromTracks(trackIds: string[]): Promise<CreatePlaylistResponse> {
  const { data } = await client.post<CreatePlaylistResponse>("/spotify/playlists", { trackIds });
  return data;
}
