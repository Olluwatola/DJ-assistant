import type { AudioFeatures, TrackDetailMode } from "@dj-assistant/types";
import type { TrackLookup } from "./spotify";
import { getCachedAudioFeatures } from "./trackData";

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

const DEEZER_RETRIES = 3;
const DEEZER_RETRY_BASE_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < DEEZER_RETRIES; attempt++) {
    try {
      return await fetch(url);
    } catch {
      if (attempt === DEEZER_RETRIES - 1) return null;
      await sleep(DEEZER_RETRY_BASE_MS * 2 ** attempt);
    }
  }
  return null;
}

export async function searchDeezerTrack(track: TrackLookup): Promise<DeezerSearchResult | null> {
  try {
    const q = encodeURIComponent(`artist:"${track.artist}" track:"${track.title}"`);
    const searchRes = await fetchWithRetry(`/deezer/search/track?q=${q}&limit=5`);
    if (!searchRes?.ok) return null;
    const { data = [] }: { data: DeezerSearchResult[] } = await searchRes.json();

    const titleLow = track.title.toLowerCase();
    const artistLow = track.artist.toLowerCase();
    return (
      data.find((r) => r.title.toLowerCase() === titleLow && r.artist.name.toLowerCase() === artistLow) ??
      data.find((r) => r.title.toLowerCase() === titleLow) ??
      data[0] ??
      null
    );
  } catch {
    return null;
  }
}

async function getDeezerBpm(track: TrackLookup): Promise<number | null> {
  const match = await searchDeezerTrack(track);
  if (!match) return null;

  const detailRes = await fetchWithRetry(`/deezer/track/${match.id}`);
  if (!detailRes?.ok) return null;
  const detail: { bpm: number } = await detailRes.json();
  return detail.bpm > 0 ? Math.round(detail.bpm) : null;
}

async function fetchDeezerFallback(tracks: TrackLookup[]): Promise<AudioFeatures[]> {
  const results: AudioFeatures[] = new Array(tracks.length);
  const CONCURRENCY = 1;
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

export async function getAudioFeaturesFromCache(
  tracks: TrackLookup[],
  mode: TrackDetailMode
): Promise<AudioFeatures[]> {
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
    let dirty = false;

    // The permanent server cache (populated only by manually-triggered chosic
    // runs) is always consulted first, regardless of mode.
    const serverResults = await getCachedAudioFeatures(misses.map((m) => m.id));
    const serverMap = new Map(serverResults.map((r) => [r.trackId, r]));
    for (const r of serverResults) {
      if (r.bpm !== null) {
        store[r.trackId] = { bpm: r.bpm, key: r.key, mode: r.mode };
        dirty = true;
        hits.push(r);
      }
    }

    const stillMissing = misses.filter((m) => serverMap.get(m.id)?.bpm === null || !serverMap.has(m.id));

    if (mode === "chosic") {
      // chosic never runs automatically - anything not already in the
      // permanent cache simply has no data until someone runs it manually.
      for (const m of stillMissing) {
        hits.push({ trackId: m.id, bpm: null, key: null, mode: null });
      }
    } else {
      const rcResults = await fetchFromReccoBeats(stillMissing);

      const rcMisses = stillMissing.filter(
        (m) => rcResults.find((r) => r.trackId === m.id)?.bpm === null
      );
      const deezerResults = rcMisses.length > 0 ? await fetchDeezerFallback(rcMisses) : [];
      const deezerMap = new Map(deezerResults.map((r) => [r.trackId, r]));

      for (const f of rcResults) {
        const result = f.bpm !== null ? f : (deezerMap.get(f.trackId) ?? f);
        if (result.bpm !== null) {
          store[result.trackId] = { bpm: result.bpm, key: result.key, mode: result.mode };
          dirty = true;
        }
        hits.push(result);
      }
    }

    if (dirty) saveStore(store);
  }

  const resultMap = new Map(hits.map((r) => [r.trackId, r]));
  return tracks.map((t) => resultMap.get(t.id) ?? { trackId: t.id, bpm: null, key: null, mode: null });
}
