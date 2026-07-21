import type { PlaylistDesignation } from "@dj-assistant/types";

export function getEnergyLabel(playlistIds: string[], designations: PlaylistDesignation[]): string | null {
  const baseDes = designations.filter((d) => d.type === "base");
  for (const d of baseDes) {
    if (playlistIds.includes(d.platformPlaylistId)) {
      if (/^\d+$/.test(d.playlistName.trim())) return `Energy ${d.playlistName.trim()}`;
      return d.playlistName;
    }
  }
  return null;
}

export function getBaseLabels(playlistIds: string[], designations: PlaylistDesignation[]): string[] {
  return designations
    .filter((d) => d.type === "base" && playlistIds.includes(d.platformPlaylistId))
    .map((d) => d.playlistName);
}

export function getSongBoxLabels(playlistIds: string[], designations: PlaylistDesignation[]): string[] {
  return designations
    .filter((d) => d.type === "song_box" && playlistIds.includes(d.platformPlaylistId))
    .map((d) => d.playlistName);
}
