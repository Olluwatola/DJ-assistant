import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISetTrack extends Document {
  setId: Types.ObjectId;
  position: number;
  platform: "spotify" | "soundcloud";
  platformTrackId: string;
  snapshotTitle: string;
  snapshotArtist: string;
}

const SetTrackSchema = new Schema<ISetTrack>({
  setId: { type: Schema.Types.ObjectId, ref: "Set", required: true },
  position: { type: Number, required: true },
  platform: { type: String, enum: ["spotify", "soundcloud"], required: true },
  platformTrackId: { type: String, required: true },
  snapshotTitle: { type: String, required: true },
  snapshotArtist: { type: String, required: true },
});

SetTrackSchema.index({ setId: 1, position: 1 });

export const SetTrack = mongoose.model<ISetTrack>("SetTrack", SetTrackSchema);
