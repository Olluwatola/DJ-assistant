import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPlaylistDesignation extends Document {
  userId: Types.ObjectId;
  platform: "spotify" | "soundcloud";
  platformPlaylistId: string;
  playlistName: string;
  type: "base" | "song_box";
}

const PlaylistDesignationSchema = new Schema<IPlaylistDesignation>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  platform: { type: String, enum: ["spotify", "soundcloud"], required: true },
  platformPlaylistId: { type: String, required: true },
  playlistName: { type: String, required: true },
  type: { type: String, enum: ["base", "song_box"], required: true },
});

PlaylistDesignationSchema.index(
  { userId: 1, platform: 1, platformPlaylistId: 1 },
  { unique: true }
);

export const PlaylistDesignation = mongoose.model<IPlaylistDesignation>(
  "PlaylistDesignation",
  PlaylistDesignationSchema
);
