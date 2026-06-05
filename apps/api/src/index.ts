import "dotenv/config";
import { app } from "./app";
import { connectDB } from "./db";
import { config } from "./config";

// Listen first — port opens immediately regardless of DB state.
app.listen(config.PORT, () => {
  console.log(`API server running on http://localhost:${config.PORT}`);
});

connectDB().catch((err: Error) => {
  console.error("MongoDB connection failed:", err.message);
});
