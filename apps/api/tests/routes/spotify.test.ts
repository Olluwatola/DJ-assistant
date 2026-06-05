import request from "supertest";
import axios from "axios";
import { app } from "../../src/app";
import { makeToken, TEST_USER_ID, TEST_SECRET } from "../helpers";

jest.mock("axios");
jest.mock("../../src/models/PlatformConnection");
jest.mock("../../src/services/spotifyClient");

import { PlatformConnection } from "../../src/models/PlatformConnection";
import * as spotifyClient from "../../src/services/spotifyClient";

const mockedAxios = axios as jest.Mocked<typeof axios>;

const TOKEN = makeToken(TEST_USER_ID);

// ── GET /api/spotify/status ────────────────────────────────────────────────

describe("GET /api/spotify/status", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/spotify/status");
    expect(res.status).toBe(401);
  });

  it("returns connected: false when no PlatformConnection exists", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get("/api/spotify/status")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(res.body.spotifyUserId).toBeNull();
  });

  it("returns connected: true with spotifyUserId when connection exists", async () => {
    (PlatformConnection.findOne as jest.Mock).mockResolvedValue({
      spotifyUserId: "spotify_user_123",
    });

    const res = await request(app)
      .get("/api/spotify/status")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.spotifyUserId).toBe("spotify_user_123");
  });
});

// ── GET /api/spotify/playlists ─────────────────────────────────────────────

describe("GET /api/spotify/playlists", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/spotify/playlists");
    expect(res.status).toBe(401);
  });

  it("returns mapped playlists from the Spotify service", async () => {
    (spotifyClient.getAllUserPlaylists as jest.Mock).mockResolvedValue([
      { id: "pl_1", name: "Energy 3", images: [{ url: "http://img.example.com/a.jpg" }], tracks: { total: 42 } },
      { id: "pl_2", name: "Afrobeats", images: [], tracks: { total: 15 } },
    ]);

    const res = await request(app)
      .get("/api/spotify/playlists")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    expect(res.body[0]).toEqual({
      id: "pl_1",
      platform: "spotify",
      name: "Energy 3",
      imageUrl: "http://img.example.com/a.jpg",
      trackCount: 42,
    });

    expect(res.body[1]).toMatchObject({
      id: "pl_2",
      name: "Afrobeats",
      imageUrl: null,
      trackCount: 15,
    });
  });

  it("returns empty array when user has no playlists", async () => {
    (spotifyClient.getAllUserPlaylists as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get("/api/spotify/playlists")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── GET /api/spotify/playlists/:playlistId/tracks ──────────────────────────

describe("GET /api/spotify/playlists/:playlistId/tracks", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/spotify/playlists/pl_1/tracks");
    expect(res.status).toBe(401);
  });

  it("returns mapped tracks for a playlist", async () => {
    (spotifyClient.getAllPlaylistTracks as jest.Mock).mockResolvedValue([
      {
        id: "track_1",
        name: "Song A",
        artists: [{ name: "Artist A" }, { name: "Artist B" }],
        album: { images: [{ url: "http://img.example.com/cover.jpg" }] },
        duration_ms: 210000,
      },
    ]);

    const res = await request(app)
      .get("/api/spotify/playlists/pl_1/tracks")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual({
      id: "track_1",
      title: "Song A",
      artist: "Artist A, Artist B",
      albumArt: "http://img.example.com/cover.jpg",
      durationMs: 210000,
    });
  });

  it("returns null albumArt when the album has no images", async () => {
    (spotifyClient.getAllPlaylistTracks as jest.Mock).mockResolvedValue([
      {
        id: "track_2",
        name: "Song B",
        artists: [{ name: "Artist C" }],
        album: { images: [] },
        duration_ms: 180000,
      },
    ]);

    const res = await request(app)
      .get("/api/spotify/playlists/pl_1/tracks")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.body[0].albumArt).toBeNull();
  });
});

// ── POST /api/spotify/audio-features ──────────────────────────────────────

describe("POST /api/spotify/audio-features", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/spotify/audio-features")
      .send({ trackIds: ["t1"] });
    expect(res.status).toBe(401);
  });

  it("returns mapped audio features", async () => {
    (spotifyClient.batchAudioFeatures as jest.Mock).mockResolvedValue([
      { id: "t1", tempo: 128.4, key: 5, mode: 1 },
      { id: "t2", tempo: 95.2, key: 9, mode: 0 },
    ]);

    const res = await request(app)
      .post("/api/spotify/audio-features")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ trackIds: ["t1", "t2"] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toEqual({ trackId: "t1", bpm: 128.4, key: 5, mode: 1 });
    expect(res.body[1]).toEqual({ trackId: "t2", bpm: 95.2, key: 9, mode: 0 });
  });

  it("passes trackIds through to the service", async () => {
    (spotifyClient.batchAudioFeatures as jest.Mock).mockResolvedValue([]);

    await request(app)
      .post("/api/spotify/audio-features")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ trackIds: ["a", "b", "c"] });

    expect(spotifyClient.batchAudioFeatures).toHaveBeenCalledWith(
      TEST_USER_ID,
      ["a", "b", "c"]
    );
  });

  it("returns 400 when trackIds is not an array", async () => {
    const res = await request(app)
      .post("/api/spotify/audio-features")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ trackIds: "not-an-array" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when trackIds field is missing", async () => {
    const res = await request(app)
      .post("/api/spotify/audio-features")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ── GET /api/spotify/connect ───────────────────────────────────────────────

describe("GET /api/spotify/connect", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/spotify/connect");
    expect(res.status).toBe(401);
  });

  it("returns JSON { url } pointing to Spotify authorize endpoint", async () => {
    const res = await request(app)
      .get("/api/spotify/connect")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toContain("https://accounts.spotify.com/authorize");
  });

  it("includes required OAuth params in the returned URL", async () => {
    const res = await request(app)
      .get("/api/spotify/connect")
      .set("Authorization", `Bearer ${TOKEN}`);

    const url = new URL(res.body.url);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("test_spotify_client_id");
    expect(url.searchParams.get("scope")).toContain("playlist-read-private");
    expect(url.searchParams.get("redirect_uri")).toBeTruthy();
    // state is a signed JWT
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  it("embeds a verifiable JWT as the state param", async () => {
    const res = await request(app)
      .get("/api/spotify/connect")
      .set("Authorization", `Bearer ${TOKEN}`);

    const url = new URL(res.body.url);
    const state = url.searchParams.get("state")!;
    const payload = require("jsonwebtoken").verify(state, TEST_SECRET) as { userId: string };
    expect(payload.userId).toBe(TEST_USER_ID);
  });
});

// ── GET /api/spotify/callback ──────────────────────────────────────────────

describe("GET /api/spotify/callback", () => {
  it("redirects to frontend with error when Spotify returns error param", async () => {
    const res = await request(app)
      .get("/api/spotify/callback?error=access_denied&state=xyz")
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=spotify_denied");
  });

  it("returns 400 for a state that is not a valid JWT", async () => {
    const res = await request(app)
      .get("/api/spotify/callback?code=mycode&state=not_a_real_jwt");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it("returns 400 for a state JWT signed with the wrong secret", async () => {
    const badState = require("jsonwebtoken").sign({ userId: TEST_USER_ID }, "wrong_secret");
    const res = await request(app)
      .get(`/api/spotify/callback?code=mycode&state=${badState}`);

    expect(res.status).toBe(400);
  });

  it("completes the OAuth flow and redirects to frontend settings on success", async () => {
    // Get a valid state JWT from /connect
    const connectRes = await request(app)
      .get("/api/spotify/connect")
      .set("Authorization", `Bearer ${TOKEN}`);
    const state = new URL(connectRes.body.url).searchParams.get("state")!;

    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: "access_t", refresh_token: "refresh_t", expires_in: 3600 },
    });
    (spotifyClient.getSpotifyProfile as jest.Mock).mockResolvedValue({
      id: "spotify_user_abc",
      display_name: "DJ Test",
    });
    (PlatformConnection.findOneAndUpdate as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .get(`/api/spotify/callback?code=auth_code&state=${state}`)
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("connected=spotify");
  });
});
