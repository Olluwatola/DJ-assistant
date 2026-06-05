import axios from "axios";
import { TEST_USER_ID } from "../helpers";

jest.mock("axios");
jest.mock("../../src/models/PlatformConnection");

import { PlatformConnection } from "../../src/models/PlatformConnection";
import {
  getAllUserPlaylists,
  getAllPlaylistTracks,
  batchAudioFeatures,
  getSpotifyProfile,
} from "../../src/services/spotifyClient";

const mockedAxios = axios as jest.Mocked<typeof axios>;

// A connection whose token has NOT expired
function makeValidConn(overrides: Partial<{ tokenExpiresAt: Date; accessToken: string }> = {}) {
  return {
    accessToken: "valid_access_token",
    refreshToken: "valid_refresh_token",
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// A connection whose token IS expired
function makeExpiredConn() {
  return makeValidConn({ tokenExpiresAt: new Date(Date.now() - 1000) });
}

// ── Token management (tested indirectly via exported functions) ────────────

describe("getValidAccessToken — via getAllUserPlaylists", () => {
  it("uses the stored token when it is still valid", async () => {
    const conn = makeValidConn();
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(conn);
    mockedAxios.get.mockResolvedValueOnce({
      data: { items: [], next: null, total: 0, limit: 50, offset: 0 },
    });

    await getAllUserPlaylists(TEST_USER_ID);

    // Token refresh (axios.post) must NOT have been called
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("/me/playlists"),
      expect.objectContaining({
        headers: { Authorization: "Bearer valid_access_token" },
      })
    );
  });

  it("refreshes the token when it is expired", async () => {
    const conn = makeExpiredConn();
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(conn);

    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: "refreshed_token", expires_in: 3600 },
    });
    mockedAxios.get.mockResolvedValueOnce({
      data: { items: [], next: null, total: 0, limit: 50, offset: 0 },
    });

    await getAllUserPlaylists(TEST_USER_ID);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://accounts.spotify.com/api/token",
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/x-www-form-urlencoded" }),
      })
    );
    // The stored token should have been updated
    expect(conn.accessToken).toBe("refreshed_token");
    expect(conn.save).toHaveBeenCalledTimes(1);

    // The subsequent API call should use the new token
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { Authorization: "Bearer refreshed_token" } })
    );
  });

  it("throws when no Spotify connection exists for the user", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(null);
    await expect(getAllUserPlaylists(TEST_USER_ID)).rejects.toThrow("Spotify not connected");
  });

  it("stores a new refresh_token if Spotify returns one during refresh", async () => {
    const conn = makeExpiredConn();
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(conn);

    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: "new_at", refresh_token: "new_rt", expires_in: 3600 },
    });
    mockedAxios.get.mockResolvedValueOnce({
      data: { items: [], next: null, total: 0, limit: 50, offset: 0 },
    });

    await getAllUserPlaylists(TEST_USER_ID);
    expect(conn.refreshToken).toBe("new_rt");
  });
});

// ── getAllUserPlaylists ─────────────────────────────────────────────────────

describe("getAllUserPlaylists", () => {
  const playlist = (id: string) => ({
    id,
    name: `Playlist ${id}`,
    images: [{ url: "http://img.example.com/cover.jpg" }],
    tracks: { total: 10 },
  });

  it("returns all items from a single page", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(makeValidConn());
    mockedAxios.get.mockResolvedValueOnce({
      data: { items: [playlist("p1"), playlist("p2")], next: null, total: 2, limit: 50, offset: 0 },
    });

    const result = await getAllUserPlaylists(TEST_USER_ID);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("p1");
    expect(result[1].id).toBe("p2");
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it("paginates through multiple pages until next is null", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(makeValidConn());
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          items: [playlist("p1"), playlist("p2")],
          next: "https://api.spotify.com/v1/me/playlists?offset=2",
          total: 4, limit: 2, offset: 0,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [playlist("p3"), playlist("p4")],
          next: null,
          total: 4, limit: 2, offset: 2,
        },
      });

    const result = await getAllUserPlaylists(TEST_USER_ID);

    expect(result).toHaveLength(4);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it("returns empty array when user has no playlists", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(makeValidConn());
    mockedAxios.get.mockResolvedValueOnce({
      data: { items: [], next: null, total: 0, limit: 50, offset: 0 },
    });

    const result = await getAllUserPlaylists(TEST_USER_ID);
    expect(result).toHaveLength(0);
  });
});

// ── getAllPlaylistTracks ────────────────────────────────────────────────────

describe("getAllPlaylistTracks", () => {
  const trackItem = (id: string) => ({
    track: {
      id,
      name: `Track ${id}`,
      artists: [{ name: "Artist" }],
      album: { images: [{ url: "http://img.example.com/a.jpg" }] },
      duration_ms: 200000,
    },
  });

  it("returns all tracks from a single page", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(makeValidConn());
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        items: [trackItem("t1"), trackItem("t2")],
        next: null, total: 2, limit: 100, offset: 0,
      },
    });

    const result = await getAllPlaylistTracks(TEST_USER_ID, "pl_abc");

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("t1");
  });

  it("paginates through multiple pages", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(makeValidConn());
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          items: [trackItem("t1")],
          next: "https://api.spotify.com/v1/playlists/pl/tracks?offset=1",
          total: 2, limit: 1, offset: 0,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [trackItem("t2")],
          next: null,
          total: 2, limit: 1, offset: 1,
        },
      });

    const result = await getAllPlaylistTracks(TEST_USER_ID, "pl_abc");
    expect(result).toHaveLength(2);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it("filters out null/local tracks (track: null items)", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(makeValidConn());
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        items: [
          trackItem("t1"),
          { track: null },             // local file
          { track: { id: null } },     // track with no ID
          trackItem("t2"),
        ],
        next: null, total: 4, limit: 100, offset: 0,
      },
    });

    const result = await getAllPlaylistTracks(TEST_USER_ID, "pl_abc");
    // Only t1 and t2 should appear — items with null track or null id are filtered
    expect(result).toHaveLength(2);
    expect(result.map((t) => t!.id)).toEqual(["t1", "t2"]);
  });
});

// ── batchAudioFeatures ─────────────────────────────────────────────────────

describe("batchAudioFeatures", () => {
  const feature = (id: string) => ({ id, tempo: 128, key: 5, mode: 1 });

  it("makes a single request for fewer than 100 IDs", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(makeValidConn());
    const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
    mockedAxios.get.mockResolvedValueOnce({
      data: { audio_features: ids.map(feature) },
    });

    const result = await batchAudioFeatures(TEST_USER_ID, ids);

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(10);
  });

  it("chunks IDs into groups of 100 and makes multiple requests", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(makeValidConn());
    const ids = Array.from({ length: 250 }, (_, i) => `t${i}`);

    // 3 pages: 100, 100, 50
    mockedAxios.get
      .mockResolvedValueOnce({ data: { audio_features: ids.slice(0, 100).map(feature) } })
      .mockResolvedValueOnce({ data: { audio_features: ids.slice(100, 200).map(feature) } })
      .mockResolvedValueOnce({ data: { audio_features: ids.slice(200).map(feature) } });

    const result = await batchAudioFeatures(TEST_USER_ID, ids);

    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(250);
  });

  it("passes IDs as a comma-separated string to the API", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(makeValidConn());
    mockedAxios.get.mockResolvedValueOnce({
      data: { audio_features: [feature("t1"), feature("t2")] },
    });

    await batchAudioFeatures(TEST_USER_ID, ["t1", "t2"]);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("/audio-features"),
      expect.objectContaining({ params: expect.objectContaining({ ids: "t1,t2" }) })
    );
  });

  it("filters out null features from the response", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(makeValidConn());
    mockedAxios.get.mockResolvedValueOnce({
      data: { audio_features: [feature("t1"), null, feature("t2"), null] },
    });

    const result = await batchAudioFeatures(TEST_USER_ID, ["t1", "x", "t2", "y"]);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.id)).toEqual(["t1", "t2"]);
  });

  it("returns empty array for empty input", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(makeValidConn());
    const result = await batchAudioFeatures(TEST_USER_ID, []);
    expect(result).toHaveLength(0);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});

// ── getSpotifyProfile ──────────────────────────────────────────────────────

describe("getSpotifyProfile", () => {
  it("returns the Spotify user profile", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(makeValidConn());
    mockedAxios.get.mockResolvedValueOnce({
      data: { id: "spotify_abc", display_name: "DJ Test" },
    });

    const profile = await getSpotifyProfile(TEST_USER_ID);

    expect(profile.id).toBe("spotify_abc");
    expect(profile.display_name).toBe("DJ Test");
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("/me"),
      expect.any(Object)
    );
  });
});
