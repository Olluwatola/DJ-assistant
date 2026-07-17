import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch, useNavigate } from "@tanstack/react-router";
import { getStatus, getPlaylists } from "../api/spotify";
import client from "../api/client";
import { useDesignations, useUpsertDesignation, useDeleteDesignation } from "../hooks/useDesignations";
import PlaylistDesignationRow from "../components/PlaylistDesignationRow";
import { clearToken } from "../lib/auth";
import type { DesignationType } from "@dj-assistant/types";

export default function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Handle redirect back from Spotify OAuth
  const search = useSearch({ strict: false }) as Record<string, string>;
  useEffect(() => {
    if (search.connected === "spotify") {
      qc.invalidateQueries({ queryKey: ["spotify-status"] });
    }
  }, [search.connected, qc]);

  const { data: status } = useQuery({
    queryKey: ["spotify-status"],
    queryFn: getStatus,
  });

  const { data: playlists, isLoading: playlistsLoading } = useQuery({
    queryKey: ["playlists"],
    queryFn: getPlaylists,
    enabled: status?.connected === true,
  });

  const { data: designations } = useDesignations();
  const upsert = useUpsertDesignation();
  const remove = useDeleteDesignation();

  const baseDesignations = designations?.filter((d) => d.type === "base") ?? [];
  const songBoxDesignations = designations?.filter((d) => d.type === "song_box") ?? [];

  function handleDesignate(playlist: { id: string; name: string }, type: DesignationType) {
    upsert.mutate({
      platform: "spotify",
      platformPlaylistId: playlist.id,
      playlistName: playlist.name,
      type,
    });
  }

  function handleRemove(playlistId: string) {
    const des = designations?.find((d) => d.platformPlaylistId === playlistId);
    if (des) remove.mutate(des._id);
  }

  async function handleConnectSpotify() {
    const { data } = await client.get<{ url: string }>("/spotify/connect");
    window.location.href = data.url;
  }

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ["playlist-tracks"] });
    qc.invalidateQueries({ queryKey: ["audio-features"] });
  }

  function handleLogout() {
    clearToken();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-6">
          <span className="font-bold text-white">DJ Set Builder</span>
          <Link to="/builder" className="text-sm text-gray-400 hover:text-white">Builder</Link>
          <Link to="/sets" className="text-sm text-gray-400 hover:text-white">My Sets</Link>
          <Link to="/settings" className="text-sm text-green-400">Settings</Link>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-white">
          Sign out
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        {/* Platform connection */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Platform Connections</h2>
          <div className="bg-gray-900 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold">S</div>
                <div>
                  <p className="font-medium">Spotify</p>
                  {status?.connected ? (
                    <p className="text-xs text-green-400">Connected{status.spotifyUserId ? ` as ${status.spotifyUserId}` : ""}</p>
                  ) : (
                    <p className="text-xs text-gray-500">Not connected</p>
                  )}
                </div>
              </div>
              {status?.connected ? (
                <button
                  onClick={handleConnectSpotify}
                  className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg transition-colors text-gray-300"
                  title="Reconnect to grant any newly-added permissions"
                >
                  Reconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectSpotify}
                  className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-sm rounded-lg transition-colors"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Summary cards */}
        {(baseDesignations.length > 0 || songBoxDesignations.length > 0) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Base Playlists</p>
              {baseDesignations.length === 0 ? (
                <p className="text-sm text-gray-600">None designated</p>
              ) : (
                <ul className="space-y-1">
                  {baseDesignations.map((d) => (
                    <li key={d._id} className="text-sm text-blue-300 truncate">{d.playlistName}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Song Boxes</p>
              {songBoxDesignations.length === 0 ? (
                <p className="text-sm text-gray-600">None designated</p>
              ) : (
                <ul className="space-y-1">
                  {songBoxDesignations.map((d) => (
                    <li key={d._id} className="text-sm text-purple-300 truncate">{d.playlistName}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Playlist designation list */}
        {status?.connected && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Playlists</h2>
              <button
                onClick={handleRefresh}
                className="text-sm text-gray-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                ↻ Refresh Library
              </button>
            </div>

            {playlistsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !playlists?.length ? (
              <p className="text-gray-500 text-sm">No playlists found on your Spotify account.</p>
            ) : (
              <div className="bg-gray-900 rounded-xl divide-y divide-gray-800/50">
                {playlists.map((playlist) => {
                  const des = designations?.find((d) => d.platformPlaylistId === playlist.id);
                  return (
                    <PlaylistDesignationRow
                      key={playlist.id}
                      playlist={playlist}
                      designation={des}
                      onDesignate={(type) => handleDesignate(playlist, type)}
                      onRemove={() => handleRemove(playlist.id)}
                      isLoading={upsert.isPending || remove.isPending}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {!status?.connected && (
          <p className="text-gray-500 text-sm">Connect your Spotify account above to start designating playlists.</p>
        )}
      </div>
    </div>
  );
}
