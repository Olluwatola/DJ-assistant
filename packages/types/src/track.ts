import { z } from "zod";
import { PlatformEnum } from "./platform";

export const AudioFeaturesSchema = z.object({
  trackId: z.string(),
  bpm: z.number().nullable(),
  key: z.number().nullable(),
  mode: z.number().nullable(),
});

export const TrackSchema = z.object({
  id: z.string(),
  platform: PlatformEnum,
  namespaceId: z.string(),
  title: z.string(),
  artist: z.string(),
  albumArt: z.string().nullable(),
  durationMs: z.number().nullable(),
  playlistIds: z.array(z.string()),
  audioFeatures: AudioFeaturesSchema.nullable(),
});

export type Track = z.infer<typeof TrackSchema>;
export type AudioFeatures = z.infer<typeof AudioFeaturesSchema>;
