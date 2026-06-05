import { z } from "zod";
import { PlatformEnum } from "./platform";

export const SetTrackSchema = z.object({
  position: z.number(),
  platform: PlatformEnum,
  platformTrackId: z.string(),
  snapshotTitle: z.string(),
  snapshotArtist: z.string(),
});

export const SetSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  name: z.string(),
  tracks: z.array(SetTrackSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SetSummarySchema = z.object({
  _id: z.string(),
  name: z.string(),
  trackCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PatchTracksBodySchema = z.object({
  tracks: z.array(
    z.object({
      platform: PlatformEnum,
      platformTrackId: z.string(),
      snapshotTitle: z.string(),
      snapshotArtist: z.string(),
    })
  ),
});

export type SetTrack = z.infer<typeof SetTrackSchema>;
export type DJSet = z.infer<typeof SetSchema>;
export type SetSummary = z.infer<typeof SetSummarySchema>;
export type PatchTracksBody = z.infer<typeof PatchTracksBodySchema>;
