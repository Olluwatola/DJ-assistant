import type { Playlist, PlaylistDesignation, DesignationType } from "@dj-assistant/types";

interface Props {
  playlist: Playlist;
  designation: PlaylistDesignation | undefined;
  onDesignate: (type: DesignationType) => void;
  onRemove: () => void;
  isLoading: boolean;
}

export default function PlaylistDesignationRow({
  playlist,
  designation,
  onDesignate,
  onRemove,
  isLoading,
}: Props) {
  const active = designation?.type;

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-800/50">
      <div className="flex items-center gap-3 min-w-0">
        {playlist.imageUrl ? (
          <img src={playlist.imageUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded bg-gray-700 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm text-white truncate">{playlist.name}</p>
          <p className="text-xs text-gray-500">{playlist.trackCount} tracks</p>
        </div>
      </div>

      <div className="flex gap-1.5 ml-4 flex-shrink-0">
        <button
          onClick={() => (active === "base" ? onRemove() : onDesignate("base"))}
          disabled={isLoading}
          className={`text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-50 ${
            active === "base"
              ? "bg-blue-600 border-blue-500 text-white"
              : "border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400"
          }`}
        >
          Base
        </button>
        <button
          onClick={() => (active === "song_box" ? onRemove() : onDesignate("song_box"))}
          disabled={isLoading}
          className={`text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-50 ${
            active === "song_box"
              ? "bg-purple-600 border-purple-500 text-white"
              : "border-gray-600 text-gray-400 hover:border-purple-500 hover:text-purple-400"
          }`}
        >
          Song Box
        </button>
      </div>
    </div>
  );
}
