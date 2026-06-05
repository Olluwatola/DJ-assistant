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
  onRemove: () => void;
}

export default function SetTrackRow({ track, index, features, onRemove }: Props) {
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
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 group"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <span className="text-xs text-gray-600 w-5 text-right flex-shrink-0">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{track.snapshotTitle}</p>
        <p className="text-xs text-gray-400 truncate">{track.snapshotArtist}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
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
