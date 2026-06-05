import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string(),
  JWT_SECRET: z.string(),
  SPOTIFY_CLIENT_ID: z.string(),
  SPOTIFY_CLIENT_SECRET: z.string(),
  SPOTIFY_REDIRECT_URI: z.string(),
  FRONTEND_URL: z.string(),
  GETSONGBPM_API_KEY: z.string(),
});

const result = ConfigSchema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = result.data;
