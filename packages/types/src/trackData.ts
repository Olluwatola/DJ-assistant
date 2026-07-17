import { z } from "zod";

export const TrackDetailModeEnum = z.enum(["chosic", "deezer_reccobeats"]);

export const TrackDetailSettingsSchema = z.object({
  mode: TrackDetailModeEnum,
});

export const ChosicRunRequestSchema = z.object({
  playlistIds: z.array(z.string()).min(1),
});

export const ChosicRunPlaylistResultSchema = z.object({
  playlistId: z.string(),
  playlistName: z.string(),
  tracksTotal: z.number(),
  tracksCached: z.number(),
});

export const ChosicRunFailureSchema = z.object({
  playlistId: z.string(),
  error: z.string(),
});

export const ChosicRunResultSchema = z.object({
  results: z.array(ChosicRunPlaylistResultSchema),
  skipped: z.array(z.string()),
  failed: z.array(ChosicRunFailureSchema),
});

export const MissingTrackDataSchema = z.object({
  playlistId: z.string(),
  playlistName: z.string(),
  totalTracks: z.number(),
  missingCount: z.number(),
});

export type TrackDetailMode = z.infer<typeof TrackDetailModeEnum>;
export type TrackDetailSettings = z.infer<typeof TrackDetailSettingsSchema>;
export type ChosicRunRequest = z.infer<typeof ChosicRunRequestSchema>;
export type ChosicRunPlaylistResult = z.infer<typeof ChosicRunPlaylistResultSchema>;
export type ChosicRunFailure = z.infer<typeof ChosicRunFailureSchema>;
export type ChosicRunResult = z.infer<typeof ChosicRunResultSchema>;
export type MissingTrackData = z.infer<typeof MissingTrackDataSchema>;
