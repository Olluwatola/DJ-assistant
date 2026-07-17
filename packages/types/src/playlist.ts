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

export const CreatePlaylistBodySchema = z.object({
  trackIds: z.array(z.string()).min(1),
  name: z.string().optional(),
});

export const CreatePlaylistResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
});

export type Playlist = z.infer<typeof PlaylistSchema>;
export type PlaylistDesignation = z.infer<typeof PlaylistDesignationSchema>;
export type UpsertDesignationBody = z.infer<typeof UpsertDesignationBodySchema>;
export type CreatePlaylistBody = z.infer<typeof CreatePlaylistBodySchema>;
export type CreatePlaylistResponse = z.infer<typeof CreatePlaylistResponseSchema>;
