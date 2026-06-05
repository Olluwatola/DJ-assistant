import mongoose, { Schema, Document } from "mongoose";

export interface IBpmCache extends Document {
  titleNorm: string;
  artistNorm: string;
  bpm: number | null;
  key: number | null;
  mode: number | null;
}

const BpmCacheSchema = new Schema<IBpmCache>({
  titleNorm: { type: String, required: true },
  artistNorm: { type: String, required: true },
  bpm: { type: Number, default: null },
  key: { type: Number, default: null },
  mode: { type: Number, default: null },
});

BpmCacheSchema.index({ titleNorm: 1, artistNorm: 1 }, { unique: true });

export const BpmCache = mongoose.model<IBpmCache>("BpmCache", BpmCacheSchema);
