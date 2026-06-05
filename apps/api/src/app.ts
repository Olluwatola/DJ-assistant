import express from "express";
import cors from "cors";
import { config } from "./config";
import authRouter from "./routes/auth";
import spotifyRouter from "./routes/spotify";
import designationsRouter from "./routes/designations";
import setsRouter from "./routes/sets";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(cors({ origin: config.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/spotify", spotifyRouter);
app.use("/api/designations", designationsRouter);
app.use("/api/sets", setsRouter);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use(errorHandler);

export { app };
