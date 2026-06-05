import client from "./client";
import type { PlaylistDesignation, UpsertDesignationBody } from "@dj-assistant/types";

export async function getDesignations(): Promise<PlaylistDesignation[]> {
  const { data } = await client.get<PlaylistDesignation[]>("/designations");
  return data;
}

export async function upsertDesignation(body: UpsertDesignationBody): Promise<PlaylistDesignation> {
  const { data } = await client.post<PlaylistDesignation>("/designations", body);
  return data;
}

export async function deleteDesignation(id: string): Promise<void> {
  await client.delete(`/designations/${id}`);
}
