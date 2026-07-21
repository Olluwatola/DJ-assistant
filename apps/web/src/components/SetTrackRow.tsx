import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SetTrack } from "@dj-assistant/types";
import type { AudioFeatures } from "@dj-assistant/types";
import PlatformBadge from "./PlatformBadge";
import KeyDisplay from "./KeyDisplay";

interface Props {
  track: SetTrack;
  index: number;
  features: AudioFeatures | undefined;
  baseLabels: string[];
  songBoxLabels: string[];
  previewUrl: string | null;
  isPlaying: boolean;
  onTogglePreview: () => void;
  onRemove: () => void;
}

export default function SetTrackRow({
  track,
  index,
  features,
  baseLabels,
  songBoxLabels,
  previewUrl,
  isPlaying,
  onTogglePreview,
  onRemove,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${track.platform}:${track.platformTrackId}:${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 group"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0 mt-1"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <button
        onClick={onTogglePreview}
        disabled={!previewUrl}
        title={previewUrl ? (isPlaying ? "Pause preview" : "Play preview") : undefined}
        className="w-5 flex-shrink-0 mt-1 text-xs text-right disabled:cursor-default"
      >
        {isPlaying ? (
          <span className="text-green-400">⏸</span>
        ) : (
          <>
            <span className="text-gray-600 group-hover:hidden">{index + 1}</span>
            <span
              className={`hidden group-hover:inline ${previewUrl ? "text-white hover:text-green-400" : "text-gray-700"}`}
            >
              ▶
            </span>
          </>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{track.snapshotTitle}</p>
        <p className="text-xs text-gray-400 truncate">{track.snapshotArtist}</p>
        {(baseLabels.length > 0 || songBoxLabels.length > 0) && (
          <div className="flex items-center gap-1 flex-wrap mt-1">
            {baseLabels.map((label) => (
              <span
                key={label}
                className="text-xs px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 leading-none"
              >
                {label}
              </span>
            ))}
            {songBoxLabels.map((label) => (
              <span
                key={label}
                className="hidden group-hover:inline-flex text-xs px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 leading-none"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 mt-1">
        {features && (
          <span className="text-xs font-mono text-gray-400 hidden sm:block">
            {Math.round(features.bpm ?? 0)} BPM
          </span>
        )}
        {features && <KeyDisplay keyInt={features.key} mode={features.mode} />}
        <PlatformBadge platform={track.platform} />
        <button
          onClick={onRemove}
          className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-1"
          title="Remove from set"
        >
          ×
        </button>
      </div>
    </div>
  );
}
