import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { isAxiosError } from "axios";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation error", issues: err.flatten().fieldErrors });
    return;
  }
  if (isAxiosError(err) && err.response) {
    // Forward the upstream (e.g. Spotify) status code so callers can distinguish
    // auth/scope failures (401/403) from other errors instead of seeing a flat 500
    console.error(err.response.data);
    res.status(err.response.status).json({ error: "Upstream request failed" });
    return;
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error(err);
  res.status(500).json({ error: message });
}
