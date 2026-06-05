import { z } from "zod";
import { PlatformEnum, DesignationTypeEnum } from "./platform";

export const PlaylistSchema = z.object({
  id: z.string(),
  platform: PlatformEnum,
  name: z.string(),
  imageUrl: z.string().nullable(),
  trackCount: z.number(),
});

export const PlaylistDesignationSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  platform: PlatformEnum,
  platformPlaylistId: z.string(),
  playlistName: z.string(),
  type: DesignationTypeEnum,
});

export const UpsertDesignationBodySchema = z.object({
  platform: PlatformEnum,
  platformPlaylistId: z.string(),
  playlistName: z.string(),
  type: DesignationTypeEnum,
});

export type Playlist = z.infer<typeof PlaylistSchema>;
export type PlaylistDesignation = z.infer<typeof PlaylistDesignationSchema>;
export type UpsertDesignationBody = z.infer<typeof UpsertDesignationBodySchema>;
