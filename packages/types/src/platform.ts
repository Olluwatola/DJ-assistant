import { z } from "zod";

export const PlatformEnum = z.enum(["spotify", "soundcloud"]);
export type Platform = z.infer<typeof PlatformEnum>;

export const DesignationTypeEnum = z.enum(["base", "song_box"]);
export type DesignationType = z.infer<typeof DesignationTypeEnum>;
