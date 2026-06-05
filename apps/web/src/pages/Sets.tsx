import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { getSets, deleteSet } from "../api/sets";
import { clearToken } from "../lib/auth";

export default function Sets() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: sets, isLoading } = useQuery({ queryKey: ["sets"], queryFn: getSets });
  const deleteMutation = useMutation({
    mutationFn: deleteSet,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sets"] }),
  });

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
          <Link to="/sets" className="text-sm text-green-400">My Sets</Link>
          <Link to="/settings" className="text-sm text-gray-400 hover:text-white">Settings</Link>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-white">
          Sign out
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">My Sets</h1>
          <Link
            to="/builder"
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-sm rounded-lg transition-colors"
          >
            + New Set
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !sets?.length ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-lg mb-2">No sets yet.</p>
            <Link to="/builder" className="text-green-400 hover:text-green-300 text-sm">
              Go build one →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {sets.map((s) => (
              <div
                key={s._id}
                className="flex items-center justify-between px-5 py-4 bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors"
              >
                <div>
                  <p className="font-medium text-white">{s.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.trackCount} track{s.trackCount !== 1 ? "s" : ""} ·{" "}
                    {new Date(s.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    to="/sets/$id"
                    params={{ id: s._id }}
                    className="text-sm text-green-400 hover:text-green-300"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${s.name}"?`)) deleteMutation.mutate(s._id);
                    }}
                    className="text-sm text-gray-600 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
