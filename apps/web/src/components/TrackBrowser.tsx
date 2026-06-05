import type { Track, PlaylistDesignation } from "@dj-assistant/types";
import TrackCard from "./TrackCard";
import type { BpmRange } from "./FilterPanel";

interface Props {
  tracks: Track[];
  isLoading: boolean;
  selectedFilterIds: string[];
  bpmRange: BpmRange;
  selectedKeys: number[];
  designations: PlaylistDesignation[];
  onAddTrack: (track: Track) => void;
}

function getEnergyLabel(track: Track, designations: PlaylistDesignation[]): string | null {
  const baseDes = designations.filter((d) => d.type === "base");
  for (const d of baseDes) {
    if (track.playlistIds.includes(d.platformPlaylistId)) {
      if (/^\d+$/.test(d.playlistName.trim())) return `Energy ${d.playlistName.trim()}`;
      return d.playlistName;
    }
  }
  return null;
}

function applyFilters(
  tracks: Track[],
  selectedFilterIds: string[],
  bpmRange: BpmRange,
  selectedKeys: number[]
): Track[] {
  return tracks.filter((t) => {
    // Playlist AND filter
    if (selectedFilterIds.length > 0 && !selectedFilterIds.every((pid) => t.playlistIds.includes(pid))) {
      return false;
    }

    // BPM range — only applied when the track has loaded audio features
    const bpm = t.audioFeatures?.bpm;
    if (bpm !== null && bpm !== undefined) {
      if (bpmRange.min !== null && bpm < bpmRange.min) return false;
      if (bpmRange.max !== null && bpm > bpmRange.max) return false;
    }

    // Key filter — tracks without key data are excluded when a key is selected
    if (selectedKeys.length > 0) {
      const key = t.audioFeatures?.key;
      if (key === null || key === undefined) return false;
      if (!selectedKeys.includes(key)) return false;
    }

    return true;
  });
}

export default function TrackBrowser({
  tracks,
  isLoading,
  selectedFilterIds,
  bpmRange,
  selectedKeys,
  designations,
  onAddTrack,
}: Props) {
  const filtered = applyFilters(tracks, selectedFilterIds, bpmRange, selectedKeys);

  const isFiltered =
    selectedFilterIds.length > 0 ||
    bpmRange.min !== null ||
    bpmRange.max !== null ||
    selectedKeys.length > 0;

  if (isLoading) {
    return (
      <div className="flex-1 space-y-2 overflow-y-auto">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <p className="text-center">
          No tracks in library yet.
          <br />
          <span className="text-sm">Designate base playlists in Settings first.</span>
        </p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <p>No tracks match your filters.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
      <p className="text-xs text-gray-600 mb-2 px-1">
        {filtered.length} track{filtered.length !== 1 ? "s" : ""}
        {isFiltered ? ` of ${tracks.length}` : ""}
      </p>
      {filtered.map((track) => (
        <TrackCard
          key={track.namespaceId}
          track={track}
          energyLabel={getEnergyLabel(track, designations)}
          onAdd={() => onAddTrack(track)}
        />
      ))}
    </div>
  );
}
