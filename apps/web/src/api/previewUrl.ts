import type { TrackLookup } from "./spotify";
import { getCachedTrackData } from "./trackData";

const LS_KEY = "dja-preview-cache-v1";

interface CacheStore {
  [spotifyId: string]: string; // only ever holds a real, resolved previewUrl
}

function loadStore(): CacheStore {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as CacheStore;
  } catch {
    return {};
  }
}

function saveStore(store: CacheStore): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {}
}

export async function getPreviewUrls(tracks: TrackLookup[]): Promise<Map<string, string | null>> {
  const store = loadStore();
  const result = new Map<string, string | null>();
  const misses: TrackLookup[] = [];

  for (const t of tracks) {
    if (t.id in store) {
      result.set(t.id, store[t.id]);
    } else {
      misses.push(t);
      result.set(t.id, null);
    }
  }

  if (misses.length > 0) {
    const serverResults = await getCachedTrackData(misses.map((m) => m.id));
    let dirty = false;
    for (const r of serverResults) {
      if (r.previewUrl !== null) {
        store[r.trackId] = r.previewUrl;
        result.set(r.trackId, r.previewUrl);
        dirty = true;
      }
    }
    if (dirty) saveStore(store);
  }

  return result;
}
