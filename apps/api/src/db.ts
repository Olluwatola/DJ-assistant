import mongoose from "mongoose";
import { config } from "./config";

export async function connectDB(): Promise<void> {
  await mongoose.connect(config.MONGO_URI);
  console.log("MongoDB connected");
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
