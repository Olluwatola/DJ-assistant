import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppSettings, GLOBAL_SETTINGS_KEY } from "../models/AppSettings";
import { TrackAudioFeatures } from "../models/TrackAudioFeatures";
import { PlaylistDesignation } from "../models/PlaylistDesignation";
import { getAllPlaylistTracks } from "../services/spotifyClient";
import { scrapeChosicPlaylist } from "../services/chosicScraper";
import {
  TrackDetailSettingsSchema,
  ChosicRunRequestSchema,
  type ChosicRunPlaylistResult,
  type ChosicRunFailure,
} from "@dj-assistant/types";

const router = Router();

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, minMs + Math.random() * (maxMs - minMs)));
}

router.get("/settings", requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await AppSettings.findOneAndUpdate(
      { key: GLOBAL_SETTINGS_KEY },
      {},
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    res.json({ mode: doc!.trackDetailMode });
  } catch (err) {
    next(err);
  }
});

router.put("/settings", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = TrackDetailSettingsSchema.parse(req.body);
    const doc = await AppSettings.findOneAndUpdate(
      { key: GLOBAL_SETTINGS_KEY },
      { trackDetailMode: body.mode },
      { upsert: true, new: true }
    ).lean();
    res.json({ mode: doc!.trackDetailMode });
  } catch (err) {
    next(err);
  }
});

router.get("/cache", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idsParam = typeof req.query.ids === "string" ? req.query.ids : "";
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);

    const cached = await TrackAudioFeatures.find({
      platform: "spotify",
      platformTrackId: { $in: ids },
    }).lean();
    const byId = new Map(cached.map((c) => [c.platformTrackId, c]));

    res.json(
      ids.map((id) => {
        const c = byId.get(id);
        return {
          trackId: id,
          bpm: c?.bpm ?? null,
          key: c?.key ?? null,
          mode: c?.mode ?? null,
          previewUrl: c?.previewUrl ?? null,
        };
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get("/missing", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const baseDesignations = await PlaylistDesignation.find({ userId, type: "base" }).lean();

    const results = [];
    for (const d of baseDesignations) {
      // One playlist failing to load (e.g. Spotify connection expired) must not
      // break the missing-data summary for the rest of the user's base playlists.
      let tracks: Awaited<ReturnType<typeof getAllPlaylistTracks>>;
      try {
        tracks = await getAllPlaylistTracks(userId, d.platformPlaylistId);
      } catch {
        continue;
      }
      const trackIds = tracks.filter((t): t is NonNullable<typeof t> => t !== null).map((t) => t.id);

      const cached = await TrackAudioFeatures.find({
        platform: "spotify",
        platformTrackId: { $in: trackIds },
      }).lean();
      const cachedIds = new Set(cached.map((c) => c.platformTrackId));

      results.push({
        playlistId: d.platformPlaylistId,
        playlistName: d.playlistName,
        totalTracks: trackIds.length,
        missingCount: trackIds.filter((id) => !cachedIds.has(id)).length,
      });
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.post("/chosic-run", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const body = ChosicRunRequestSchema.parse(req.body);

    const baseDesignations = await PlaylistDesignation.find({
      userId,
      type: "base",
      platformPlaylistId: { $in: body.playlistIds },
    }).lean();
    const validIds = new Set(baseDesignations.map((d) => d.platformPlaylistId));
    const skipped = body.playlistIds.filter((id) => !validIds.has(id));

    const results: ChosicRunPlaylistResult[] = [];
    const failed: ChosicRunFailure[] = [];
    for (let i = 0; i < baseDesignations.length; i++) {
      const designation = baseDesignations[i];
      if (i > 0) {
        // Deliberate pacing between playlists - never hammer chosic back-to-back
        await randomDelay(4000, 9000);
      }

      try {
        const { tracks } = await scrapeChosicPlaylist(designation.platformPlaylistId);

        let tracksCached = 0;
        for (const t of tracks) {
          if (t.bpm === null && t.previewUrl === null) continue;
          await TrackAudioFeatures.findOneAndUpdate(
            { platform: "spotify", platformTrackId: t.id },
            {
              bpm: t.bpm,
              key: t.key,
              mode: t.mode,
              previewUrl: t.previewUrl,
              source: "chosic",
              fetchedAt: new Date(),
            },
            { upsert: true }
          );
          tracksCached++;
        }

        results.push({
          playlistId: designation.platformPlaylistId,
          playlistName: designation.playlistName,
          tracksTotal: tracks.length,
          tracksCached,
        });
      } catch (err) {
        // A failed playlist (Cloudflare block surviving all retries, etc.) must not
        // abort the rest of the batch when multiple playlists were selected.
        failed.push({
          playlistId: designation.platformPlaylistId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    res.json({ results, skipped, failed });
  } catch (err) {
    next(err);
  }
});

export default router;
