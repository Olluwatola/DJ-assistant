import type { Track, PlaylistDesignation } from "@dj-assistant/types";
import TrackCard from "./TrackCard";
import type { BpmRange } from "./FilterPanel";
import { getEnergyLabel, getSongBoxLabels } from "../lib/trackLabels";

interface Props {
  tracks: Track[];
  isLoading: boolean;
  isFeaturesLoading: boolean;
  selectedFilterIds: string[];
  bpmRange: BpmRange;
  selectedKeys: number[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  designations: PlaylistDesignation[];
  onAddTrack: (track: Track) => void;
  playingId: string | null;
  onTogglePreview: (id: string, url: string | null) => void;
}

function applyFilters(
  tracks: Track[],
  selectedFilterIds: string[],
  bpmRange: BpmRange,
  selectedKeys: number[],
  searchQuery: string,
  isFeaturesLoading: boolean
): Track[] {
  const query = searchQuery.trim().toLowerCase();

  return tracks.filter((t) => {
    // Text search over title/artist
    if (query && !t.title.toLowerCase().includes(query) && !t.artist.toLowerCase().includes(query)) {
      return false;
    }

    // Playlist AND filter
    if (selectedFilterIds.length > 0 && !selectedFilterIds.every((pid) => t.playlistIds.includes(pid))) {
      return false;
    }

    // Skip BPM/key filters while audio features are still loading to avoid
    // hiding all tracks when the query transitions to a new key with no cached data
    if (isFeaturesLoading) return true;

    // BPM range — when a range is active, tracks without BPM data are excluded
    if (bpmRange.min !== null || bpmRange.max !== null) {
      const bpm = t.audioFeatures?.bpm;
      if (bpm === null || bpm === undefined) return false;
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
  isFeaturesLoading,
  selectedFilterIds,
  bpmRange,
  selectedKeys,
  searchQuery,
  onSearchChange,
  designations,
  onAddTrack,
  playingId,
  onTogglePreview,
}: Props) {
  const filtered = applyFilters(tracks, selectedFilterIds, bpmRange, selectedKeys, searchQuery, isFeaturesLoading);

  const isFiltered =
    selectedFilterIds.length > 0 ||
    bpmRange.min !== null ||
    bpmRange.max !== null ||
    selectedKeys.length > 0 ||
    searchQuery.trim() !== "";

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

  const searchBox = (
    <div className="relative mb-2 px-1 flex-shrink-0">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search tracks…"
        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
      />
      {searchQuery && (
        <button
          onClick={() => onSearchChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-sm"
          title="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-y-auto pr-1">
        {searchBox}
        <div className="flex-1 flex items-center justify-center text-gray-600">
          <p>No tracks match your filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
      {searchBox}
      <p className="text-xs text-gray-600 mb-2 px-1">
        {filtered.length} track{filtered.length !== 1 ? "s" : ""}
        {isFiltered ? ` of ${tracks.length}` : ""}
      </p>
      {filtered.map((track) => (
        <TrackCard
          key={track.namespaceId}
          track={track}
          energyLabel={getEnergyLabel(track.playlistIds, designations)}
          songBoxLabels={getSongBoxLabels(track.playlistIds, designations)}
          featuresLoading={isFeaturesLoading}
          onAdd={() => onAddTrack(track)}
          isPlaying={playingId === track.id}
          onTogglePreview={() => onTogglePreview(track.id, track.previewUrl)}
        />
      ))}
    </div>
  );
}
