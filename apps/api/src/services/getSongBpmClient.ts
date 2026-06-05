import axios from "axios";
import { config } from "../config";
import { BpmCache } from "../models/BpmCache";

const BASE = "https://api.getsongbpm.com";

const NOTE_TO_PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8,
  Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

function parseKeyOf(keyOf: string): { key: number; mode: number } | null {
  const match = keyOf.match(/^([A-G][b#]?)(m)?$/);
  if (!match) return null;
  const pc = NOTE_TO_PC[match[1]];
  if (pc === undefined) return null;
  return { key: pc, mode: match[2] === "m" ? 0 : 1 };
}

export interface BpmResult {
  bpm: number | null;
  key: number | null;
  mode: number | null;
}

export interface TrackInput {
  id: string;
  title: string;
  artist: string;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

async function fetchFromApi(title: string, artist: string): Promise<BpmResult> {
  const lookup = `song:${encodeURIComponent(title)}+artist:${encodeURIComponent(artist)}`;
  const { data } = await axios.get<{
    search?: Array<{ title: string; tempo: string; key_of: string }>;
  }>(`${BASE}/search/`, {
    params: { api_key: config.GETSONGBPM_API_KEY, type: "song", lookup },
  });

  const results = data.search ?? [];
  const match =
    results.find((r) => r.title.toLowerCase() === title.toLowerCase()) ?? results[0];

  if (!match) return { bpm: null, key: null, mode: null };

  const bpm = parseInt(match.tempo, 10) || null;
  const keyData = match.key_of ? parseKeyOf(match.key_of) : null;

  return { bpm, key: keyData?.key ?? null, mode: keyData?.mode ?? null };
}

/**
 * Fetches BPM/key for a batch of tracks.
 * Checks the BpmCache collection first; only calls the GetSongBPM API for misses.
 * Results for misses are written back to the cache.
 * Uses a concurrency pool of 5 to avoid hammering the free-tier rate limit.
 */
export async function batchBpmLookup(tracks: TrackInput[]): Promise<Map<string, BpmResult>> {
  const resultMap = new Map<string, BpmResult>();

  // Build normalised keys and bulk-query the cache
  const normKeys = tracks.map((t) => ({
    id: t.id,
    titleNorm: normalize(t.title),
    artistNorm: normalize(t.artist),
  }));

  const cached = await BpmCache.find({
    $or: normKeys.map(({ titleNorm, artistNorm }) => ({ titleNorm, artistNorm })),
  }).lean();

  const cacheMap = new Map(
    cached.map((c) => [`${c.titleNorm}||${c.artistNorm}`, c])
  );

  const misses: typeof normKeys = [];
  for (const nk of normKeys) {
    const hit = cacheMap.get(`${nk.titleNorm}||${nk.artistNorm}`);
    if (hit) {
      resultMap.set(nk.id, { bpm: hit.bpm, key: hit.key, mode: hit.mode });
    } else {
      misses.push(nk);
    }
  }

  if (misses.length === 0) return resultMap;

  // Concurrency pool — 5 workers process misses in parallel
  const CONCURRENCY = 5;
  let nextIndex = 0;

  async function worker() {
    let i: number;
    while ((i = nextIndex++) < misses.length) {
      const { id, titleNorm, artistNorm } = misses[i];
      const track = tracks.find((t) => t.id === id)!;
      let result: BpmResult;
      try {
        result = await fetchFromApi(track.title, track.artist);
      } catch {
        result = { bpm: null, key: null, mode: null };
      }

      resultMap.set(id, result);

      // Write to cache — ignore duplicate key errors (concurrent requests for same song)
      await BpmCache.findOneAndUpdate(
        { titleNorm, artistNorm },
        { $setOnInsert: { titleNorm, artistNorm, ...result } },
        { upsert: true }
      ).catch(() => {});
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, misses.length) }, worker));

  return resultMap;
}
