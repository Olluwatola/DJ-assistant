import type { PlaylistDesignation } from "@dj-assistant/types";
import { NOTE_NAMES } from "../lib/pitchClass";

export interface BpmRange {
  min: number | null;
  max: number | null;
}

interface Props {
  designations: PlaylistDesignation[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  bpmRange: BpmRange;
  onBpmChange: (range: BpmRange) => void;
  selectedKeys: number[];
  onToggleKey: (key: number) => void;
  isFeaturesLoading: boolean;
  audioFeaturesAvailable: boolean;
  onClearAll: () => void;
}

export default function FilterPanel({
  designations,
  selectedIds,
  onToggle,
  bpmRange,
  onBpmChange,
  selectedKeys,
  onToggleKey,
  isFeaturesLoading,
  audioFeaturesAvailable,
  onClearAll,
}: Props) {
  const base = designations.filter((d) => d.type === "base");
  const songBoxes = designations.filter((d) => d.type === "song_box");

  const activeCount = selectedIds.length + (bpmRange.min !== null || bpmRange.max !== null ? 1 : 0) + selectedKeys.length;

  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 rounded-xl p-4 space-y-5 h-fit overflow-y-auto max-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Filters</h3>
        {activeCount > 0 && (
          <button onClick={onClearAll} className="text-xs text-gray-500 hover:text-white">
            Clear {activeCount}
          </button>
        )}
      </div>

      {/* Base Playlists */}
      {base.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Base Playlists</p>
          <div className="space-y-1">
            {base.map((d) => (
              <label key={d._id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(d.platformPlaylistId)}
                  onChange={() => onToggle(d.platformPlaylistId)}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-300 group-hover:text-white truncate">
                  {d.playlistName}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Song Boxes */}
      {songBoxes.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Song Boxes</p>
          <div className="space-y-1">
            {songBoxes.map((d) => (
              <label key={d._id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(d.platformPlaylistId)}
                  onChange={() => onToggle(d.platformPlaylistId)}
                  className="accent-purple-500"
                />
                <span className="text-sm text-gray-300 group-hover:text-white truncate">
                  {d.playlistName}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* BPM Range */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">BPM</p>
          {isFeaturesLoading && (
            <span className="text-xs text-gray-600 animate-pulse">loading…</span>
          )}
          {(bpmRange.min !== null || bpmRange.max !== null) && (
            <button
              onClick={() => onBpmChange({ min: null, max: null })}
              className="text-xs text-gray-600 hover:text-white"
            >
              reset
            </button>
          )}
        </div>
        {!isFeaturesLoading && !audioFeaturesAvailable ? (
          <p className="text-xs text-gray-600 leading-relaxed">
            Unavailable — Spotify removed the audio features API for development apps.{" "}
            <a
              href="https://developer.spotify.com/documentation/web-api/concepts/quota-modes"
              target="_blank"
              rel="noreferrer"
              className="text-gray-500 underline hover:text-gray-300"
            >
              Request extended access
            </a>{" "}
            to enable BPM &amp; key filters.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={300}
              placeholder="min"
              value={bpmRange.min ?? ""}
              onChange={(e) =>
                onBpmChange({ ...bpmRange, min: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
            <span className="text-gray-600 text-xs flex-shrink-0">–</span>
            <input
              type="number"
              min={0}
              max={300}
              placeholder="max"
              value={bpmRange.max ?? ""}
              onChange={(e) =>
                onBpmChange({ ...bpmRange, max: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
          </div>
        )}
      </div>

      {/* Key Filter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Key</p>
          {selectedKeys.length > 0 && (
            <button
              onClick={() => selectedKeys.forEach((k) => onToggleKey(k))}
              className="text-xs text-gray-600 hover:text-white"
            >
              reset
            </button>
          )}
        </div>
        {!isFeaturesLoading && !audioFeaturesAvailable ? (
          <p className="text-xs text-gray-600">See note above.</p>
        ) : (
          <div className="grid grid-cols-4 gap-1">
            {NOTE_NAMES.map((note, idx) => (
              <button
                key={idx}
                onClick={() => onToggleKey(idx)}
                className={`px-1 py-1 rounded text-xs font-mono transition-colors ${
                  selectedKeys.includes(idx)
                    ? "bg-green-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {note}
              </button>
            ))}
          </div>
        )}
      </div>

      {base.length === 0 && songBoxes.length === 0 && (
        <p className="text-xs text-gray-600">No playlists designated yet.</p>
      )}
    </aside>
  );
}
