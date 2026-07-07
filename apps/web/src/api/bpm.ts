import type { AudioFeatures } from "@dj-assistant/types";
import type { TrackLookup } from "./spotify";

const LS_KEY = "dja-bpm-cache-v2";
const RC = "https://api.reccobeats.com/v1";

interface CacheStore {
  [spotifyId: string]: { bpm: number | null; key: number | null; mode: number | null };
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

function spotifyIdFromHref(href: string): string | null {
  const match = href?.match(/\/track\/([A-Za-z0-9]+)/);
  return match?.[1] ?? null;
}

interface RcTrack { id: string; href: string }
interface RcAudioFeatures { href: string; tempo: number; key: number; mode: number }
interface DeezerSearchResult { id: number; title: string; artist: { name: string } }

// ── ReccoBeats (BPM + key) ──────────────────────────────────────────────────

async function fetchFromReccoBeats(tracks: TrackLookup[]): Promise<AudioFeatures[]> {
  const resultMap = new Map<string, AudioFeatures>(
    tracks.map((t) => [t.id, { trackId: t.id, bpm: null, key: null, mode: null }])
  );

  const spotifyToRc = new Map<string, string>();
  for (let i = 0; i < tracks.length; i += 10) {
    const chunk = tracks.slice(i, i + 10);
    try {
      const qs = chunk.map((t) => `ids=${encodeURIComponent(t.id)}`).join("&");
      const res = await fetch(`${RC}/track?${qs}`);
      if (!res.ok) continue;
      const data: { content: RcTrack[] } = await res.json();
      for (const item of data.content ?? []) {
        const sid = spotifyIdFromHref(item.href);
        if (sid && item.id) spotifyToRc.set(sid, item.id);
      }
    } catch { /* skip */ }
  }

  if (spotifyToRc.size === 0) return [...resultMap.values()];

  const rcIds = [...spotifyToRc.values()];
  for (let i = 0; i < rcIds.length; i += 10) {
    const chunk = rcIds.slice(i, i + 10);
    try {
      const qs = chunk.map((id) => `ids=${encodeURIComponent(id)}`).join("&");
      const res = await fetch(`${RC}/audio-features?${qs}`);
      if (!res.ok) continue;
      const data: { content: RcAudioFeatures[] } = await res.json();
      for (const feat of data.content ?? []) {
        const sid = spotifyIdFromHref(feat.href);
        if (!sid) continue;
        resultMap.set(sid, {
          trackId: sid,
          bpm: feat.tempo ? Math.round(feat.tempo) : null,
          key: typeof feat.key === "number" && feat.key >= 0 ? feat.key : null,
          mode: typeof feat.mode === "number" ? feat.mode : null,
        });
      }
    } catch { /* skip */ }
  }

  return tracks.map((t) => resultMap.get(t.id)!);
}

// ── Deezer fallback (BPM only) ──────────────────────────────────────────────

async function getDeezerBpm(track: TrackLookup): Promise<number | null> {
  try {
    const q = encodeURIComponent(`artist:"${track.artist}" track:"${track.title}"`);
    const searchRes = await fetch(`/deezer/search/track?q=${q}&limit=5`);
    if (!searchRes.ok) return null;
    const { data = [] }: { data: DeezerSearchResult[] } = await searchRes.json();

    const titleLow = track.title.toLowerCase();
    const artistLow = track.artist.toLowerCase();
    const match =
      data.find((r) => r.title.toLowerCase() === titleLow && r.artist.name.toLowerCase() === artistLow) ??
      data.find((r) => r.title.toLowerCase() === titleLow) ??
      data[0];

    if (!match) return null;

    const detailRes = await fetch(`/deezer/track/${match.id}`);
    if (!detailRes.ok) return null;
    const detail: { bpm: number } = await detailRes.json();
    return detail.bpm > 0 ? Math.round(detail.bpm) : null;
  } catch {
    return null;
  }
}

async function fetchDeezerFallback(tracks: TrackLookup[]): Promise<AudioFeatures[]> {
  const results: AudioFeatures[] = new Array(tracks.length);
  const CONCURRENCY = 3;
  let next = 0;

  async function worker() {
    let i: number;
    while ((i = next++) < tracks.length) {
      const bpm = await getDeezerBpm(tracks[i]);
      results[i] = { trackId: tracks[i].id, bpm, key: null, mode: null };
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tracks.length) }, worker));
  return results;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function getAudioFeaturesFromCache(tracks: TrackLookup[]): Promise<AudioFeatures[]> {
  const store = loadStore();
  const hits: AudioFeatures[] = [];
  const misses: TrackLookup[] = [];

  for (const t of tracks) {
    const cached = store[t.id];
    if (cached !== undefined && cached.bpm !== null) {
      hits.push({ trackId: t.id, ...cached });
    } else {
      misses.push(t);
    }
  }

  if (misses.length > 0) {
    const rcResults = await fetchFromReccoBeats(misses);

    const rcMisses = misses.filter((m) => rcResults.find((r) => r.trackId === m.id)?.bpm === null);
    const deezerResults = rcMisses.length > 0 ? await fetchDeezerFallback(rcMisses) : [];
    const deezerMap = new Map(deezerResults.map((r) => [r.trackId, r]));

    let dirty = false;
    for (const f of rcResults) {
      const result = f.bpm !== null ? f : (deezerMap.get(f.trackId) ?? f);
      if (result.bpm !== null) {
        store[result.trackId] = { bpm: result.bpm, key: result.key, mode: result.mode };
        dirty = true;
      }
      hits.push(result);
    }
    if (dirty) saveStore(store);
  }

  const resultMap = new Map(hits.map((r) => [r.trackId, r]));
  return tracks.map((t) => resultMap.get(t.id) ?? { trackId: t.id, bpm: null, key: null, mode: null });
}
