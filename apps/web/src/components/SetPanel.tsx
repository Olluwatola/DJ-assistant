import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { SetTrack } from "@dj-assistant/types";
import type { AudioFeatures } from "@dj-assistant/types";
import SetTrackRow from "./SetTrackRow";

interface Props {
  name: string;
  tracks: SetTrack[];
  isDirty: boolean;
  audioFeaturesMap: Map<string, AudioFeatures>;
  onNameChange: (name: string) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  onRemove: (index: number) => void;
  onSave: () => Promise<string>;
}

export default function SetPanel({
  name,
  tracks,
  isDirty,
  audioFeaturesMap,
  onNameChange,
  onReorder,
  onRemove,
  onSave,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tracks.findIndex(
      (_, i) => `${tracks[i].platform}:${tracks[i].platformTrackId}:${i}` === active.id
    );
    const newIndex = tracks.findIndex(
      (_, i) => `${tracks[i].platform}:${tracks[i].platformTrackId}:${i}` === over.id
    );

    if (oldIndex !== -1 && newIndex !== -1) onReorder(oldIndex, newIndex);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave();
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const totalDuration = tracks.reduce((sum, t) => {
    const f = audioFeaturesMap.get(t.platformTrackId);
    void f;
    return sum;
  }, 0);
  void totalDuration;

  const sortableIds = tracks.map((t, i) => `${t.platform}:${t.platformTrackId}:${i}`);

  return (
    <aside className="w-72 flex-shrink-0 bg-gray-900 rounded-xl flex flex-col h-full max-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full bg-transparent text-white font-semibold text-base focus:outline-none focus:border-b focus:border-green-500 pb-0.5"
          placeholder="Set name…"
        />
        <p className="text-xs text-gray-500 mt-1">
          {tracks.length} track{tracks.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {tracks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm px-4 text-center">
            Click "+" on a track to add it here
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {tracks.map((t, i) => (
                <SetTrackRow
                  key={`${t.platform}:${t.platformTrackId}:${i}`}
                  track={t}
                  index={i}
                  features={audioFeaturesMap.get(t.platformTrackId)}
                  onRemove={() => onRemove(i)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty || tracks.length === 0}
          className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? "Saving…" : savedMsg ? "Saved ✓" : "Save Set"}
        </button>
      </div>
    </aside>
  );
}
