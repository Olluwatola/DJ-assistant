import { z } from "zod";

export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  createdAt: z.string(),
});

export const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
});

export type User = z.infer<typeof UserSchema>;
export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type LoginBody = z.infer<typeof LoginBodySchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
