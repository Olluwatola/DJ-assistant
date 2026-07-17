import { useState } from "react";
import type { Track, PlaylistDesignation } from "@dj-assistant/types";
import TrackCard from "./TrackCard";
import { getSongBoxLabels } from "../lib/trackLabels";
import { createPlaylistFromTracks } from "../api/spotify";

interface Props {
  tracks: Track[];
  designations: PlaylistDesignation[];
  isFeaturesLoading: boolean;
  onAddTrack: (track: Track) => void;
}

export default function OrphanedTracksPanel({ tracks, designations, isFeaturesLoading, onAddTrack }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdPlaylist, setCreatedPlaylist] = useState<{ name: string; url: string } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  if (tracks.length === 0) return null;

  async function handleExport() {
    setCreating(true);
    setCreateError(null);
    try {
      const playlist = await createPlaylistFromTracks(tracks.map((t) => t.id));
      setCreatedPlaylist(playlist);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setCreateError(
        status === 400 || status === 403
          ? "Reconnect Spotify in Settings to grant playlist creation access."
          : "Couldn't create the playlist. Try again."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mb-3 flex-shrink-0 bg-orange-950/20 border border-orange-800/40 rounded-lg overflow-hidden">
      <div className="w-full flex items-center justify-between flex-wrap gap-x-2 gap-y-1 px-3 py-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 text-left min-w-0"
        >
          <span className="text-sm text-orange-300 flex items-center gap-2">
            <span>{expanded ? "▾" : "▸"}</span>
            Uncategorized song box tracks
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-900/60 text-orange-300">
              {tracks.length}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-3 flex-shrink-0">
          {isFeaturesLoading && (
            <span className="text-xs text-gray-500 animate-pulse">loading BPM/key…</span>
          )}
          <button
            onClick={handleExport}
            disabled={creating}
            className="text-xs px-2 py-1 rounded-md bg-orange-900/50 text-orange-200 hover:bg-orange-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creating…" : "Export to Spotify"}
          </button>
        </div>
      </div>

      {(createdPlaylist || createError) && (
        <p className="text-xs px-3 pb-2">
          {createdPlaylist ? (
            <>
              <span className="text-green-400">Created "{createdPlaylist.name}"</span>{" "}
              <a
                href={createdPlaylist.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-300 underline hover:text-green-200"
              >
                Open in Spotify ↗
              </a>
            </>
          ) : (
            <span className="text-red-400">{createError}</span>
          )}
        </p>
      )}

      {expanded && (
        <div className="max-h-64 overflow-y-auto px-2 pb-2 space-y-0.5 border-t border-orange-800/30">
          <p className="text-xs text-gray-500 px-1 pt-2">
            In a song box but not in any base (energy) playlist. Assign them an energy level in Spotify, then Refresh.
          </p>
          {tracks.map((track) => (
            <TrackCard
              key={track.namespaceId}
              track={track}
              energyLabel={null}
              songBoxLabels={getSongBoxLabels(track, designations)}
              featuresLoading={isFeaturesLoading}
              onAdd={() => onAddTrack(track)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
