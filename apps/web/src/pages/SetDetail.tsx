import { useMemo } from "react";
import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getSet } from "../api/sets";
import { getAudioFeatures } from "../api/spotify";

import PlatformBadge from "../components/PlatformBadge";
import KeyDisplay from "../components/KeyDisplay";
import { clearToken } from "../lib/auth";
import type { AudioFeatures } from "@dj-assistant/types";

export default function SetDetail() {
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const { data: set, isLoading } = useQuery({
    queryKey: ["set", id],
    queryFn: () => getSet(id),
  });

  // Fetch fresh audio features for the tracks in this set
  const trackIds = useMemo(
    () => set?.tracks.filter((t) => t.platform === "spotify").map((t) => t.platformTrackId) ?? [],
    [set]
  );

  const { data: featuresData } = useQuery({
    queryKey: ["set-audio-features", id, trackIds.join(",")],
    queryFn: () => getAudioFeatures(trackIds),
    enabled: trackIds.length > 0,
    staleTime: 20 * 60 * 1000,
  });

  const audioFeaturesMap = useMemo(() => {
    const m = new Map<string, AudioFeatures>();
    featuresData?.forEach((f) => m.set(f.trackId, f));
    return m;
  }, [featuresData]);

  function handleEditInBuilder() {
    navigate({ to: "/builder" });
  }

  function handleLogout() {
    clearToken();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-6">
          <span className="font-bold text-white">DJ Set Builder</span>
          <Link to="/builder" className="text-sm text-gray-400 hover:text-white">Builder</Link>
          <Link to="/sets" className="text-sm text-gray-400 hover:text-white">My Sets</Link>
          <Link to="/settings" className="text-sm text-gray-400 hover:text-white">Settings</Link>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-white">
          Sign out
        </button>
      </nav>

      {isLoading ? (
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !set ? (
        <div className="flex items-center justify-center py-20 text-gray-600">
          Set not found.
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{set.name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {set.tracks.length} track{set.tracks.length !== 1 ? "s" : ""} ·{" "}
                Updated {new Date(set.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={handleEditInBuilder}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg transition-colors"
            >
              Edit in Builder
            </button>
          </div>

          <div className="bg-gray-900 rounded-xl divide-y divide-gray-800/50">
            {set.tracks.map((t, i) => {
              const features = audioFeaturesMap.get(t.platformTrackId);
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-sm text-gray-600 w-6 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{t.snapshotTitle}</p>
                    <p className="text-xs text-gray-400 truncate">{t.snapshotArtist}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {features && (
                      <span className="text-xs font-mono text-gray-400">
                        {Math.round(features.bpm ?? 0)} BPM
                      </span>
                    )}
                    {features && <KeyDisplay keyInt={features.key} mode={features.mode} />}
                    <PlatformBadge platform={t.platform} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
