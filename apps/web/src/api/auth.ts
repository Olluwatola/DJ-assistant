import client from "./client";
import type { AuthResponse, RegisterBody, LoginBody } from "@dj-assistant/types";

export async function register(body: RegisterBody): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>("/auth/register", body);
  return data;
}

export async function login(body: LoginBody): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>("/auth/login", body);
  return data;
}
