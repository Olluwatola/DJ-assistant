# Plan: GetSongBPM Integration

## Context

Spotify's `/audio-features` endpoint was retired for non-extended-access apps on Dec 31 2024 — it already returns a 403 (see the `batchAudioFeatures` catch block in `apps/api/src/services/spotifyClient.ts:139`). The entire BPM/key column in the UI is currently dead. GetSongBPM replaces it as the primary source.

## How GetSongBPM API Works

- Base URL: `https://api.getsongbpm.com`
- Auth: `?api_key=<key>` query parameter on every request
- Relevant endpoint: `GET /search/?api_key=KEY&type=song&lookup=song:<title>+artist:<artist>`
- Response shape (success):
  ```json
  {
    "search": [
      {
        "id": "abc123",
        "title": "Song Title",
        "artist": { "name": "Artist Name" },
        "tempo": "128",
        "key_of": "Am"
      }
    ]
  }
  ```
- `tempo` is a string integer (e.g. `"128"`) → parse with `parseInt`
- `key_of` is a string like `"C"`, `"Am"`, `"F#"`, `"Dbm"` → must be parsed into `{ key: 0-11, mode: 0|1 }` to match the existing `AudioFeaturesSchema`
- Best match strategy: take `search[0]` after filtering for exact title match (case-insensitive)
- **No batch endpoint exists** — every lookup is one HTTP request (confirmed via API clients and community code)
- Rate limit: not officially documented; free tier commonly described as 1 req/sec in community usage
- Parallelism strategy: controlled concurrency pool (5 in-flight at once) — far faster than sequential, still respectful of rate limits

## Key String → Pitch Class + Mode Mapping

GetSongBPM `key_of` format: note name (C, C#, Db, D, D#, Eb, E, F, F#, Gb, G, G#, Ab, A, A#, Bb, B) + optional `m` suffix for minor.

Pitch class table (matches Spotify's convention in `pitchClass.ts`):
```
C=0, C#/Db=1, D=2, D#/Eb=3, E=4, F=5, F#/Gb=6, G=7, G#/Ab=8, A=9, A#/Bb=10, B=11
```
Mode: no suffix or `maj` → `1` (major), `m` or `min` → `0` (minor)

The `formatKey()` helper in `apps/web/src/lib/pitchClass.ts` already formats `{ key, mode }` numbers → display string, so the schema stays unchanged.

---

## Files to Change

| File | Change |
|------|--------|
| `.env.example` | Add `GETSONGBPM_API_KEY=` |
| `apps/api/src/config.ts` | Add `GETSONGBPM_API_KEY` to `ConfigSchema` |
| `apps/api/src/services/getSongBpmClient.ts` | **New** — API wrapper + key parser |
| `apps/api/src/routes/spotify.ts` | Extend `/audio-features` body to accept `title`/`artist` per track; call GetSongBPM for null results |
| `apps/web/src/api/spotify.ts` | Change `getAudioFeatures(trackIds)` → `getAudioFeatures(tracks)` |
| `apps/web/src/hooks/useLibrary.ts` | Pass `{ id, title, artist }` objects to `getAudioFeatures` |

---

## Step-by-Step Implementation

### 1. `.env.example`

Add after the Spotify block:

```
# GetSongBPM
GETSONGBPM_API_KEY=
```

Get a free API key at https://getsongbpm.com/api.

---

### 2. `apps/api/src/config.ts`

Add to `ConfigSchema`:

```ts
GETSONGBPM_API_KEY: z.string(),
```

---

### 3. `apps/api/src/services/getSongBpmClient.ts` (new file)

```ts
import axios from "axios";
import { config } from "../config";

const BASE = "https://api.getsongbpm.com";

// Pitch class table — matches Spotify's pitch class convention
const NOTE_TO_PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8,
  Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

function parseKeyOf(keyOf: string): { key: number; mode: number } | null {
  // e.g. "Am", "C#", "F#m", "Dbm", "C"
  const match = keyOf.match(/^([A-G][b#]?)(m)?$/);
  if (!match) return null;
  const pc = NOTE_TO_PC[match[1]];
  if (pc === undefined) return null;
  return { key: pc, mode: match[2] === "m" ? 0 : 1 };
}

interface BpmResult {
  bpm: number;
  key: number;
  mode: number;
}

export async function lookupBpmAndKey(
  title: string,
  artist: string
): Promise<BpmResult | null> {
  const lookup = `song:${encodeURIComponent(title)}+artist:${encodeURIComponent(artist)}`;
  const { data } = await axios.get<{ search?: Array<{ title: string; tempo: string; key_of: string }> }>(
    `${BASE}/search/`,
    { params: { api_key: config.GETSONGBPM_API_KEY, type: "song", lookup } }
  );

  const results = data.search ?? [];
  // Take first result whose title matches (case-insensitive exact match preferred)
  const match =
    results.find((r) => r.title.toLowerCase() === title.toLowerCase()) ??
    results[0];

  if (!match) return null;

  const bpm = parseInt(match.tempo, 10);
  const keyData = parseKeyOf(match.key_of ?? "");

  if (!bpm || !keyData) return null;
  return { bpm, ...keyData };
}
```

**Concurrency model:** `lookupBpmAndKey` is a single-request function. The caller runs multiple of these concurrently via a pool (see Step 4) — the function itself has no coordination logic.

---

### 4. `apps/api/src/routes/spotify.ts` — modify `/audio-features`

Change the request body schema and handler:

**Before:**
```ts
const { trackIds } = z.object({ trackIds: z.array(z.string()) }).parse(req.body);
const features = await batchAudioFeatures(userId, trackIds);
const mapped = features.map((f) => ({
  trackId: f.id,
  bpm: f.tempo ?? null,
  key: f.key ?? null,
  mode: f.mode ?? null,
}));
res.json(mapped);
```

**After:**
```ts
const TrackInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
});
const { tracks } = z.object({ tracks: z.array(TrackInputSchema) }).parse(req.body);

// Try Spotify first (may 403 — batchAudioFeatures handles that gracefully)
const spotifyFeatures = await batchAudioFeatures(userId, tracks.map((t) => t.id));
const spotifyMap = new Map(spotifyFeatures.map((f) => [f.id, f]));

// Tracks that Spotify didn't cover go to GetSongBPM
const needsLookup = tracks.filter((t) => !spotifyMap.get(t.id)?.tempo);

// Concurrency pool — keeps CONCURRENCY requests in-flight at all times.
// No library needed; a simple worker-pool over an index counter does the job.
const CONCURRENCY = 5; // raise if you upgrade to a paid GetSongBPM plan
const gsbpmMap = new Map<string, { bpm: number; key: number; mode: number } | null>();

async function worker() {
  // Each worker grabs the next unclaimed index atomically via closure
  let i: number;
  while ((i = nextIndex++) < needsLookup.length) {
    const track = needsLookup[i];
    try {
      gsbpmMap.set(track.id, await lookupBpmAndKey(track.title, track.artist));
    } catch {
      gsbpmMap.set(track.id, null);
    }
  }
}

let nextIndex = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// Merge Spotify + GetSongBPM results, preserving original track order
const results: AudioFeatures[] = tracks.map((track) => {
  const sf = spotifyMap.get(track.id);
  if (sf?.tempo) return { trackId: track.id, bpm: sf.tempo, key: sf.key, mode: sf.mode };
  const g = gsbpmMap.get(track.id);
  return { trackId: track.id, bpm: g?.bpm ?? null, key: g?.key ?? null, mode: g?.mode ?? null };
});

res.json(results);
```

Add the import at the top of the route file:
```ts
import { lookupBpmAndKey } from "../services/getSongBpmClient";
import type { AudioFeatures } from "@dj-assistant/types";
```

**Latency comparison:**

| Strategy | 100 tracks @ avg 200ms/req |
|---|---|
| Sequential (old plan) | ~100 s |
| Pool of 5 (this plan) | ~4–5 s |
| Pool of 10 | ~2–3 s |
| All parallel | ~0.5 s but risks 429s |

With `CONCURRENCY = 5` and ~200ms per request, 100 tracks completes in ~4 seconds — well within Express's default 30s timeout. If the free tier proves stricter, lower to 3; if you're on a paid plan, raise to 10+.

---

### 5. `apps/web/src/api/spotify.ts`

Change the `getAudioFeatures` function signature:

```ts
export interface TrackLookup {
  id: string;
  title: string;
  artist: string;
}

export async function getAudioFeatures(tracks: TrackLookup[]): Promise<AudioFeatures[]> {
  const { data } = await client.post<AudioFeatures[]>("/spotify/audio-features", { tracks });
  return data;
}
```

---

### 6. `apps/web/src/hooks/useLibrary.ts`

Replace the `getAudioFeatures` call site to pass full track metadata.

**Before:**
```ts
queryKey: ["audio-features", [...allTrackIds].sort().join(",")],
queryFn: () => spotifyApi.getAudioFeatures(allTrackIds),
```

**After:**
```ts
// Build the lookup list from enrichedMap (title/artist are already there)
const trackLookups = useMemo(
  () => [...enrichedMap.values()].map((t) => ({ id: t.id, title: t.title, artist: t.artist })),
  [enrichedMap]
);

// ...

queryKey: ["audio-features", [...allTrackIds].sort().join(",")],
queryFn: () => spotifyApi.getAudioFeatures(trackLookups),
enabled: trackLookups.length > 0,
staleTime: STALE,
```

The `allTrackIds` derived value (used for the `enabled` guard and query key) stays as-is.

---

## Server-Side Caching (Optional Improvement)

The concurrent pool is fast for a fresh load, but a MongoDB `BpmCache` collection keyed on `(titleNorm, artistNorm)` would:
- Skip the API call on repeat loads
- Survive server restarts (unlike in-memory)

No TTL or expiry — BPM and key are immutable properties of a song and never change after release. Documents are written once and kept forever. The only reason to delete an entry is if GetSongBPM had a data error, which is a manual `deleteOne` fix, not something to automate.

This is left out of the initial implementation — React Query's 20-minute client-side cache covers repeated page loads within a session, which is sufficient for the MVP.

---

## Testing Checklist

- [ ] Set `GETSONGBPM_API_KEY` in `apps/api/.env`
- [ ] Restart API server
- [ ] Open Builder page — tracks should load without BPM/key initially, then populate as GetSongBPM responses arrive
- [ ] Verify `KeyDisplay` shows e.g. "Am → A min" and BPM shows e.g. "128"
- [ ] Check network tab: POST `/api/spotify/audio-features` body should have `tracks: [{ id, title, artist }]`
- [ ] Test a track not found in GetSongBPM — BPM/key columns should show "—" not crash
- [ ] Test an artist with special characters (e.g. "Sigur Rós", "R&B") — verify URL encoding works
