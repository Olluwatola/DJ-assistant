import mongoose, { Schema, Document } from "mongoose";

export interface ITrackAudioFeatures extends Document {
  platform: "spotify";
  platformTrackId: string;
  bpm: number | null;
  key: number | null;
  mode: number | null;
  previewUrl: string | null;
  source: "chosic" | "deezer_reccobeats";
  fetchedAt: Date;
}

const TrackAudioFeaturesSchema = new Schema<ITrackAudioFeatures>({
  platform: { type: String, enum: ["spotify"], required: true },
  platformTrackId: { type: String, required: true },
  bpm: { type: Number, default: null },
  key: { type: Number, default: null },
  mode: { type: Number, default: null },
  previewUrl: { type: String, default: null },
  source: { type: String, enum: ["chosic", "deezer_reccobeats"], required: true },
  fetchedAt: { type: Date, default: Date.now },
});

TrackAudioFeaturesSchema.index({ platform: 1, platformTrackId: 1 }, { unique: true });

export const TrackAudioFeatures = mongoose.model<ITrackAudioFeatures>(
  "TrackAudioFeatures",
  TrackAudioFeaturesSchema
);
