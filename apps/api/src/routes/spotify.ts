import { Router, Request, Response, NextFunction } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { PlatformConnection } from "../models/PlatformConnection";
import {
  getAllUserPlaylists,
  getAllPlaylistTracks,
  batchAudioFeatures,
  getSpotifyProfile,
} from "../services/spotifyClient";
import { batchBpmLookup } from "../services/getSongBpmClient";
import { config } from "../config";

const router = Router();

// GET /api/spotify/connect
// Called by the frontend with a Bearer token (via axios).
// Returns the Spotify auth URL as JSON — the frontend then does window.location.href = url.
// The userId is embedded in the OAuth state as a signed JWT, so no server-side session is needed
// and the callback doesn't require an Authorization header.
router.get("/connect", requireAuth, (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;

  // Signed JWT as state: carries userId + short expiry, acts as the CSRF token.
  const state = jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: "10m" });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.SPOTIFY_CLIENT_ID,
    redirect_uri: config.SPOTIFY_REDIRECT_URI,
    scope: "playlist-read-private playlist-read-collaborative",
    state,
    show_dialog: "false",
  });

  res.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
});

// GET /api/spotify/callback
// Called by Spotify as a browser redirect — no Authorization header available.
// The state param is the signed JWT issued by /connect; verifying it proves authenticity
// and recovers the userId without a separate auth header or server-side session.
router.get("/callback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      res.redirect(`${config.FRONTEND_URL}/settings?error=spotify_denied`);
      return;
    }

    let userId: string;
    try {
      const payload = jwt.verify(state, config.JWT_SECRET) as { userId: string };
      userId = payload.userId;
    } catch {
      res.status(400).json({ error: "Invalid or expired OAuth state" });
      return;
    }

    const credentials = Buffer.from(
      `${config.SPOTIFY_CLIENT_ID}:${config.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.SPOTIFY_REDIRECT_URI,
    });

    const { data: tokenData } = await axios.post(
      "https://accounts.spotify.com/api/token",
      params.toString(),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    await PlatformConnection.findOneAndUpdate(
      { userId, platform: "spotify" },
      {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
      { upsert: true, new: true }
    );

    const profile = await getSpotifyProfile(userId);
    await PlatformConnection.findOneAndUpdate(
      { userId, platform: "spotify" },
      { spotifyUserId: profile.id }
    );

    res.redirect(`${config.FRONTEND_URL}/settings?connected=spotify`);
  } catch (err) {
    next(err);
  }
});

router.get("/status", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const conn = await PlatformConnection.findOne({ userId, platform: "spotify" });
    res.json({ connected: !!conn, spotifyUserId: conn?.spotifyUserId ?? null });
  } catch (err) {
    next(err);
  }
});

router.get("/playlists", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const raw = await getAllUserPlaylists(userId);
    const playlists = raw.map((p) => ({
      id: p.id,
      platform: "spotify" as const,
      name: p.name,
      imageUrl: p.images?.[0]?.url ?? null,
      trackCount: p.items?.total ?? 0,
    }));
    res.json(playlists);
  } catch (err) {
    next(err);
  }
});

router.get(
  "/playlists/:playlistId/items",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthRequest).userId;
      const { playlistId } = req.params;
      const raw = await getAllPlaylistTracks(userId, playlistId);
      const tracks = raw.map((t) => ({
        id: t!.id,
        title: t!.name,
        artist: t!.artists.map((a) => a.name).join(", "),
        albumArt: t!.album.images?.[0]?.url ?? null,
        durationMs: t!.duration_ms,
      }));
      res.json(tracks);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/audio-features",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthRequest).userId;
      const { tracks } = z
        .object({
          tracks: z.array(z.object({ id: z.string(), title: z.string(), artist: z.string() })),
        })
        .parse(req.body);

      // Try Spotify first — 403s gracefully since their endpoint was retired
      const spotifyFeatures = await batchAudioFeatures(userId, tracks.map((t) => t.id));
      const spotifyMap = new Map(spotifyFeatures.map((f) => [f.id, f]));

      // Tracks Spotify didn't cover go to GetSongBPM (cache-first, then API)
      const needsLookup = tracks.filter((t) => !spotifyMap.get(t.id)?.tempo);
      const bpmMap = await batchBpmLookup(needsLookup);

      const result = tracks.map((t) => {
        const sf = spotifyMap.get(t.id);
        if (sf?.tempo) {
          return { trackId: t.id, bpm: sf.tempo, key: sf.key ?? null, mode: sf.mode ?? null };
        }
        const g = bpmMap.get(t.id);
        return { trackId: t.id, bpm: g?.bpm ?? null, key: g?.key ?? null, mode: g?.mode ?? null };
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
