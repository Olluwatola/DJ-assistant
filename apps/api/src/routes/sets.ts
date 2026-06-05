import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { Set } from "../models/Set";
import { SetTrack } from "../models/SetTrack";
import { PatchTracksBodySchema } from "@dj-assistant/types";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const sets = await Set.find({ userId }).sort({ updatedAt: -1 }).lean();

    const withCounts = await Promise.all(
      sets.map(async (s) => ({
        _id: s._id.toString(),
        name: s.name,
        trackCount: await SetTrack.countDocuments({ setId: s._id }),
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }))
    );

    res.json(withCounts);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const s = await Set.create({ userId, name });
    res.status(201).json({
      _id: s._id.toString(),
      userId: s.userId.toString(),
      name: s.name,
      tracks: [],
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const s = await Set.findById(req.params.id).lean();
    if (!s) { res.status(404).json({ error: "Set not found" }); return; }
    if (s.userId.toString() !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    const tracks = await SetTrack.find({ setId: s._id }).sort({ position: 1 }).lean();

    res.json({
      _id: s._id.toString(),
      userId: s.userId.toString(),
      name: s.name,
      tracks: tracks.map((t) => ({
        position: t.position,
        platform: t.platform,
        platformTrackId: t.platformTrackId,
        snapshotTitle: t.snapshotTitle,
        snapshotArtist: t.snapshotArtist,
      })),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const s = await Set.findById(req.params.id);
    if (!s) { res.status(404).json({ error: "Set not found" }); return; }
    if (s.userId.toString() !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
    s.name = name;
    await s.save();
    res.json({ _id: s._id.toString(), name: s.name });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/tracks", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { tracks } = PatchTracksBodySchema.parse(req.body);

    const s = await Set.findById(req.params.id);
    if (!s) { res.status(404).json({ error: "Set not found" }); return; }
    if (s.userId.toString() !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    await SetTrack.deleteMany({ setId: s._id });

    if (tracks.length > 0) {
      await SetTrack.insertMany(
        tracks.map((t, i) => ({
          setId: s._id,
          position: i,
          platform: t.platform,
          platformTrackId: t.platformTrackId,
          snapshotTitle: t.snapshotTitle,
          snapshotArtist: t.snapshotArtist,
        }))
      );
    }

    s.updatedAt = new Date();
    await s.save();

    res.json({ success: true, trackCount: tracks.length });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const s = await Set.findById(req.params.id).lean();
    if (!s) { res.status(404).json({ error: "Set not found" }); return; }
    if (s.userId.toString() !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    await SetTrack.deleteMany({ setId: s._id });
    await Set.deleteOne({ _id: s._id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
