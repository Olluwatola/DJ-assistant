import { useState } from "react";
import type { PlaylistDesignation } from "@dj-assistant/types";
import { useRunChosicFetch } from "../hooks/useTrackData";

interface Props {
  open: boolean;
  onClose: () => void;
  basePlaylists: PlaylistDesignation[];
}

export default function ChosicRunModal({ open, onClose, basePlaylists }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const runChosic = useRunChosicFetch();

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleClose() {
    setSelected(new Set());
    runChosic.reset();
    onClose();
  }

  function handleRun() {
    runChosic.mutate([...selected]);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Fetch via Chosic</h3>
          <button onClick={handleClose} className="text-gray-500 hover:text-white">
            ✕
          </button>
        </div>

        {!runChosic.data ? (
          <>
            <p className="text-sm text-gray-400">
              Select which base playlists to fetch bpm/key data for. This opens a real browser
              window and can take up to a minute per playlist.
            </p>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {basePlaylists.map((d) => (
                <label
                  key={d._id}
                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-800/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(d.platformPlaylistId)}
                    onChange={() => toggle(d.platformPlaylistId)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-white truncate">{d.playlistName}</span>
                </label>
              ))}
            </div>

            {runChosic.isError && (
              <p className="text-sm text-red-400">
                {runChosic.error instanceof Error ? runChosic.error.message : "Something went wrong."}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleClose}
                className="px-4 py-1.5 text-sm text-gray-400 hover:text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRun}
                disabled={selected.size === 0 || runChosic.isPending}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm rounded-lg transition-colors"
              >
                {runChosic.isPending ? "Running…" : `Run (${selected.size})`}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              {runChosic.data.results.map((r) => (
                <div key={r.playlistId} className="text-sm text-gray-300">
                  <span className="text-white">{r.playlistName}</span>: {r.tracksCached}/{r.tracksTotal}{" "}
                  tracks cached
                </div>
              ))}
              {runChosic.data.failed.map((f) => (
                <div key={f.playlistId} className="text-sm text-red-400">
                  {f.playlistId} failed: {f.error}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleClose}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
