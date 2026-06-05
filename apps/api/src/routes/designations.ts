import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { PlaylistDesignation } from "../models/PlaylistDesignation";
import { UpsertDesignationBodySchema } from "@dj-assistant/types";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const designations = await PlaylistDesignation.find({ userId }).lean();
    res.json(
      designations.map((d) => ({
        _id: d._id.toString(),
        userId: d.userId.toString(),
        platform: d.platform,
        platformPlaylistId: d.platformPlaylistId,
        playlistName: d.playlistName,
        type: d.type,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const body = UpsertDesignationBodySchema.parse(req.body);

    const doc = await PlaylistDesignation.findOneAndUpdate(
      { userId, platform: body.platform, platformPlaylistId: body.platformPlaylistId },
      { playlistName: body.playlistName, type: body.type },
      { upsert: true, new: true }
    ).lean();

    res.status(201).json({
      _id: doc!._id.toString(),
      userId: doc!.userId.toString(),
      platform: doc!.platform,
      platformPlaylistId: doc!.platformPlaylistId,
      playlistName: doc!.playlistName,
      type: doc!.type,
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const doc = await PlaylistDesignation.findById(req.params.id).lean();

    if (!doc) {
      res.status(404).json({ error: "Designation not found" });
      return;
    }
    if (doc.userId.toString() !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await PlaylistDesignation.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
