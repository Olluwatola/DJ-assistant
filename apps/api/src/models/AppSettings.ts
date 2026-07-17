import mongoose, { Schema, Document } from "mongoose";

export interface IAppSettings extends Document {
  key: string;
  trackDetailMode: "chosic" | "deezer_reccobeats";
}

const AppSettingsSchema = new Schema<IAppSettings>({
  key: { type: String, required: true, unique: true },
  trackDetailMode: {
    type: String,
    enum: ["chosic", "deezer_reccobeats"],
    default: "deezer_reccobeats",
  },
});

export const AppSettings = mongoose.model<IAppSettings>("AppSettings", AppSettingsSchema);

export const GLOBAL_SETTINGS_KEY = "global";
