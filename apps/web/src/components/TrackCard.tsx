import type { Track } from "@dj-assistant/types";
import PlatformBadge from "./PlatformBadge";
import KeyDisplay from "./KeyDisplay";

export interface TrackCardProps {
  track: Track;
  onAdd: () => void;
  energyLabel?: string | null;
  songBoxLabels?: string[];
  featuresLoading?: boolean;
  isPlaying: boolean;
  onTogglePreview: () => void;
}

export default function TrackCard({
  track,
  onAdd,
  energyLabel,
  songBoxLabels,
  featuresLoading,
  isPlaying,
  onTogglePreview,
}: TrackCardProps) {
  const featuresPending = !track.audioFeatures && featuresLoading;
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800 group transition-colors min-h-[4.75rem]">
      <div className="relative w-10 h-10 flex-shrink-0">
        {track.albumArt ? (
          <img src={track.albumArt} alt="" className="w-10 h-10 rounded object-cover" />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-700" />
        )}
        {track.previewUrl && (
          <button
            onClick={onTogglePreview}
            className={`absolute inset-0 flex items-center justify-center rounded bg-black/60 text-white text-sm transition-opacity ${
              isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            title={isPlaying ? "Pause preview" : "Play preview"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{track.title}</p>
        <p className="text-xs text-gray-400 truncate">{track.artist}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap min-h-[1.25rem]">
          <PlatformBadge platform={track.platform} />
          {energyLabel && (
            <span className="text-xs text-blue-400">{energyLabel}</span>
          )}
          {songBoxLabels?.map((label) => (
            <span
              key={label}
              className="text-xs px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 leading-none"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 text-right">
        <div className="hidden sm:block text-right">
          {featuresPending ? (
            <p className="text-xs text-gray-600 animate-pulse">loading…</p>
          ) : (
            <>
              <p className="text-xs text-gray-300 font-mono">
                {track.audioFeatures?.bpm != null ? `${Math.round(track.audioFeatures.bpm)} BPM` : "—"}
              </p>
              <KeyDisplay keyInt={track.audioFeatures?.key} mode={track.audioFeatures?.mode} />
            </>
          )}
        </div>
        <button
          onClick={onAdd}
          className="w-7 h-7 rounded-full bg-gray-700 hover:bg-green-600 text-gray-300 hover:text-white flex items-center justify-center text-lg leading-none transition-colors opacity-0 group-hover:opacity-100"
          title="Add to set"
        >
          +
        </button>
      </div>
    </div>
  );
}
