import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPlatformConnection extends Document {
  userId: Types.ObjectId;
  platform: "spotify" | "soundcloud";
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  spotifyUserId: string;
}

const PlatformConnectionSchema = new Schema<IPlatformConnection>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  platform: { type: String, enum: ["spotify", "soundcloud"], required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  tokenExpiresAt: { type: Date, required: true },
  spotifyUserId: { type: String, default: "" },
});

PlatformConnectionSchema.index({ userId: 1, platform: 1 }, { unique: true });

export const PlatformConnection = mongoose.model<IPlatformConnection>(
  "PlatformConnection",
  PlatformConnectionSchema
);
