import { useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useLibrary } from "../hooks/useLibrary";
import { useActiveSet } from "../hooks/useActiveSet";
import { useDesignations } from "../hooks/useDesignations";
import FilterPanel, { type BpmRange } from "../components/FilterPanel";
import TrackBrowser from "../components/TrackBrowser";
import SetPanel from "../components/SetPanel";
import { clearToken } from "../lib/auth";
import type { AudioFeatures } from "@dj-assistant/types";

export default function Builder() {
  const navigate = useNavigate();

  const [selectedFilterIds, setSelectedFilterIds] = useState<string[]>([]);
  const [bpmRange, setBpmRange] = useState<BpmRange>({ min: null, max: null });
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);

  const { tracks, isLoading, isFeaturesLoading, refresh } = useLibrary();
  const { data: designations } = useDesignations();
  const activeSet = useActiveSet();

  const audioFeaturesMap = useMemo(() => {
    const m = new Map<string, AudioFeatures>();
    tracks.forEach((t) => {
      if (t.audioFeatures) m.set(t.id, t.audioFeatures);
    });
    return m;
  }, [tracks]);

  function toggleFilter(id: string) {
    setSelectedFilterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleKey(key: number) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function clearAll() {
    setSelectedFilterIds([]);
    setBpmRange({ min: null, max: null });
    setSelectedKeys([]);
  }

  function handleLogout() {
    clearToken();
    navigate({ to: "/login" });
  }

  const hasNoDesignations = !isLoading && (designations?.length ?? 0) === 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-6">
          <span className="font-bold text-white">DJ Set Builder</span>
          <Link to="/builder" className="text-sm text-green-400">Builder</Link>
          <Link to="/sets" className="text-sm text-gray-400 hover:text-white">My Sets</Link>
          <Link to="/settings" className="text-sm text-gray-400 hover:text-white">Settings</Link>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={refresh}
            className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            ↻ Refresh Library
          </button>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-white">
            Sign out
          </button>
        </div>
      </nav>

      {hasNoDesignations && (
        <div className="mx-6 mt-4 px-4 py-3 bg-yellow-900/30 border border-yellow-700/40 rounded-lg text-sm text-yellow-300">
          No playlists designated yet.{" "}
          <Link to="/settings" className="underline hover:text-yellow-200">
            Go to Settings
          </Link>{" "}
          to designate base playlists and song boxes.
        </div>
      )}

      <div className="flex gap-4 px-6 py-5 flex-1 overflow-hidden">
        <FilterPanel
          designations={designations ?? []}
          selectedIds={selectedFilterIds}
          onToggle={toggleFilter}
          bpmRange={bpmRange}
          onBpmChange={setBpmRange}
          selectedKeys={selectedKeys}
          onToggleKey={toggleKey}
          isFeaturesLoading={isFeaturesLoading}
          onClearAll={clearAll}
        />

        <TrackBrowser
          tracks={tracks}
          isLoading={isLoading}
          isFeaturesLoading={isFeaturesLoading}
          selectedFilterIds={selectedFilterIds}
          bpmRange={bpmRange}
          selectedKeys={selectedKeys}
          designations={designations ?? []}
          onAddTrack={activeSet.addTrack}
        />

        <SetPanel
          name={activeSet.name}
          tracks={activeSet.tracks}
          isDirty={activeSet.isDirty}
          audioFeaturesMap={audioFeaturesMap}
          onNameChange={activeSet.setName}
          onReorder={activeSet.reorderTracks}
          onRemove={activeSet.removeTrack}
          onSave={activeSet.save}
        />
      </div>

      <footer className="px-6 py-2 border-t border-gray-800 flex-shrink-0 text-center">
        <span className="text-xs text-gray-600">
          BPM &amp; key data provided by{" "}
          <a
            href="https://getsongbpm.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 underline"
          >
            GetSongBPM
          </a>
        </span>
      </footer>
    </div>
  );
}
