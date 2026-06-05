import client from "./client";
import type { DJSet, SetSummary, PatchTracksBody } from "@dj-assistant/types";

export async function getSets(): Promise<SetSummary[]> {
  const { data } = await client.get<SetSummary[]>("/sets");
  return data;
}

export async function createSet(name: string): Promise<DJSet> {
  const { data } = await client.post<DJSet>("/sets", { name });
  return data;
}

export async function getSet(id: string): Promise<DJSet> {
  const { data } = await client.get<DJSet>(`/sets/${id}`);
  return data;
}

export async function renameSet(id: string, name: string): Promise<void> {
  await client.put(`/sets/${id}`, { name });
}

export async function patchSetTracks(id: string, body: PatchTracksBody): Promise<void> {
  await client.patch(`/sets/${id}/tracks`, body);
}

export async function deleteSet(id: string): Promise<void> {
  await client.delete(`/sets/${id}`);
}
