import type { Track, PlaylistDesignation } from "@dj-assistant/types";

export function getEnergyLabel(track: Track, designations: PlaylistDesignation[]): string | null {
  const baseDes = designations.filter((d) => d.type === "base");
  for (const d of baseDes) {
    if (track.playlistIds.includes(d.platformPlaylistId)) {
      if (/^\d+$/.test(d.playlistName.trim())) return `Energy ${d.playlistName.trim()}`;
      return d.playlistName;
    }
  }
  return null;
}

export function getSongBoxLabels(track: Track, designations: PlaylistDesignation[]): string[] {
  return designations
    .filter((d) => d.type === "song_box" && track.playlistIds.includes(d.platformPlaylistId))
    .map((d) => d.playlistName);
}
