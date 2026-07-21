import axios from "axios";
import { PlatformConnection } from "../models/PlatformConnection";
import { config } from "../config";

const SPOTIFY_API = "https://api.spotify.com/v1";

async function getValidAccessToken(userId: string): Promise<string> {
  const conn = await PlatformConnection.findOne({ userId, platform: "spotify" });
  if (!conn) throw new Error("Spotify not connected");

  const bufferMs = 60 * 1000;
  if (conn.tokenExpiresAt.getTime() - bufferMs > Date.now()) {
    return conn.accessToken;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: conn.refreshToken,
  });

  const credentials = Buffer.from(
    `${config.SPOTIFY_CLIENT_ID}:${config.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const { data } = await axios.post(
    "https://accounts.spotify.com/api/token",
    params.toString(),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  conn.accessToken = data.access_token;
  conn.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
  if (data.refresh_token) conn.refreshToken = data.refresh_token;
  await conn.save();

  return conn.accessToken;
}

async function spotifyGet<T>(userId: string, path: string, params?: Record<string, unknown>): Promise<T> {
  const token = await getValidAccessToken(userId);
  const { data } = await axios.get<T>(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return data;
}

async function spotifyPost<T>(userId: string, path: string, body: unknown): Promise<T> {
  const token = await getValidAccessToken(userId);
  const { data } = await axios.post<T>(`${SPOTIFY_API}${path}`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

interface SpotifyPaginated<T> {
  items: T[];
  next: string | null;
  total: number;
  limit: number;
  offset: number;
}

export async function getAllUserPlaylists(userId: string) {
  const playlists: Array<{ id: string; name: string; images: Array<{ url: string }> | null; items: { total: number } }> = [];
  let offset = 0;

  while (true) {
    const page = await spotifyGet<SpotifyPaginated<{ id: string; name: string; images: Array<{ url: string }> | null; items: { total: number } }>>(
      userId,
      "/me/playlists",
      { limit: 50, offset }
    );
    playlists.push(...page.items.filter(Boolean));
    if (!page.next) break;
    offset += page.limit;
  }

  return playlists;
}

interface SpotifyPlaylistItem {
  // /items endpoint wraps the track under "item", not "track"
  item: {
    id: string;
    name: string;
    type: string;
    artists: Array<{ name: string }>;
    album: { images: Array<{ url: string }> };
    duration_ms: number;
    preview_url: string | null;
  } | null;
}

export async function getAllPlaylistTracks(userId: string, playlistId: string) {
  const tracks: SpotifyPlaylistItem["item"][] = [];
  let offset = 0;

  while (true) {
    const page = await spotifyGet<SpotifyPaginated<SpotifyPlaylistItem>>(
      userId,
      `/playlists/${playlistId}/items`,
      { limit: 100, offset }
    );

    for (const element of page.items) {
      // Only include tracks (not podcast episodes) with a valid id
      if (element.item?.id && element.item.type === "track") {
        tracks.push(element.item);
      }
    }

    if (!page.next) break;
    offset += page.limit;
  }

  return tracks;
}

interface SpotifyAudioFeature {
  id: string;
  tempo: number;
  key: number;
  mode: number;
}

export async function batchAudioFeatures(userId: string, trackIds: string[]) {
  // Spotify retired GET /audio-features for non-extended-access apps (Dec 31 2024).
  // Catch 403 and return empty rather than crashing the whole library load.
  const features: SpotifyAudioFeature[] = [];
  const chunkSize = 100;

  for (let i = 0; i < trackIds.length; i += chunkSize) {
    const chunk = trackIds.slice(i, i + chunkSize);
    try {
      const data = await spotifyGet<{ audio_features: (SpotifyAudioFeature | null)[] }>(
        userId,
        "/audio-features",
        { ids: chunk.join(",") }
      );
      features.push(...data.audio_features.filter((f): f is SpotifyAudioFeature => f !== null));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        // Endpoint no longer available — return what we have so far (empty)
        break;
      }
      throw err;
    }
  }

  return features;
}

export async function getSpotifyProfile(userId: string) {
  return spotifyGet<{ id: string; display_name: string }>(userId, "/me");
}

interface SpotifyNewPlaylist {
  id: string;
  external_urls: { spotify: string };
}

export async function createPlaylist(userId: string, spotifyUserId: string, name: string) {
  return spotifyPost<SpotifyNewPlaylist>(userId, `/users/${spotifyUserId}/playlists`, {
    name,
    public: false,
  });
}

export async function addTracksToPlaylist(userId: string, playlistId: string, trackIds: string[]) {
  const uris = trackIds.map((id) => `spotify:track:${id}`);
  const chunkSize = 100;

  for (let i = 0; i < uris.length; i += chunkSize) {
    const chunk = uris.slice(i, i + chunkSize);
    await spotifyPost(userId, `/playlists/${playlistId}/tracks`, { uris: chunk });
  }
}
