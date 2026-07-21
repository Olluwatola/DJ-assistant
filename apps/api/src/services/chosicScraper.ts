/**
 * Scrapes chosic.com's playlist exporter for a Spotify playlist by intercepting
 * the api.spotify.com responses its page fetches client-side (playlist, audio-features,
 * artists), instead of scraping chosic's own CSV/TXT output.
 *
 * chosic still gets real /audio-features data back (Spotify retired that endpoint
 * for our own app's client id in Dec 2024 - see spotifyClient.ts), and sits behind
 * Cloudflare bot detection, so this must run headed.
 *
 * This is only ever invoked manually via POST /api/track-data/chosic-run for
 * explicitly selected base playlists - never automatically, never for orphans.
 */
import { chromium } from "playwright";

export interface ChosicScrapedTrack {
  id: string;
  bpm: number | null;
  key: number | null;
  mode: number | null;
  previewUrl: string | null;
}

export interface ChosicScrapeResult {
  name: string;
  owner: string | null;
  tracks: ChosicScrapedTrack[];
}

interface SpotifyAudioFeature {
  id: string;
  tempo: number;
  key: number;
  mode: number;
}

interface SpotifyTrack {
  id: string;
  type: string;
  preview_url: string | null;
}

interface SpotifyPlaylistItem {
  track: SpotifyTrack | null;
}

interface SpotifyPlaylistResponse {
  name: string;
  owner?: { display_name?: string };
  tracks: {
    items: SpotifyPlaylistItem[];
    total: number;
  };
}

interface SpotifyPlaylistItemsPageResponse {
  items: SpotifyPlaylistItem[];
}

const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = [5000, 15000, 45000];

// Playlists over 100 tracks make chosic's page fetch additional pages via
// /v1/playlists/{id}/items?offset=100&limit=100 (Spotify's own page size cap).
// Rather than a fixed wait, poll until we've seen `total` items AND network
// activity has gone quiet for QUIET_MS - adapts to however many extra pages
// or audio-features batches a large playlist needs.
const QUIET_MS = 2500;
const MAX_COLLECT_MS = 60000;
const POLL_INTERVAL_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number, spread = 0.2): number {
  const delta = ms * spread;
  return ms + (Math.random() * 2 - 1) * delta;
}

async function randomDelay(minMs: number, maxMs: number): Promise<void> {
  await sleep(minMs + Math.random() * (maxMs - minMs));
}

async function attemptScrape(playlistId: string): Promise<ChosicScrapeResult> {
  const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = await context.newPage();

  let playlistMeta: { name: string; owner: string | null } | undefined;
  let expectedTotal: number | undefined;
  const rawItems: SpotifyPlaylistItem[] = [];
  const audioFeatureBatches: Array<{ audio_features: (SpotifyAudioFeature | null)[] }> = [];
  let lastActivityAt = Date.now();

  page.on("response", async (response) => {
    const url = response.url();
    if (!url.startsWith("https://api.spotify.com/v1/") || response.status() !== 200) return;
    try {
      if (/\/v1\/playlists\/[^/]+$/.test(url)) {
        const data: SpotifyPlaylistResponse = await response.json();
        playlistMeta = { name: data.name, owner: data.owner?.display_name ?? null };
        expectedTotal = data.tracks.total;
        rawItems.push(...data.tracks.items);
        lastActivityAt = Date.now();
      } else if (/\/v1\/playlists\/[^/]+\/items(\?|$)/.test(url)) {
        const data: SpotifyPlaylistItemsPageResponse = await response.json();
        rawItems.push(...data.items);
        lastActivityAt = Date.now();
      } else if (url.includes("/v1/audio-features")) {
        audioFeatureBatches.push(await response.json());
        lastActivityAt = Date.now();
      }
    } catch {
      // ignore non-JSON / already-consumed bodies
    }
  });

  try {
    await page.goto("https://www.chosic.com/spotify-playlist-exporter/", {
      waitUntil: "domcontentloaded",
    });

    if (await page.locator("text=Sorry, you have been blocked").isVisible().catch(() => false)) {
      throw new Error("Cloudflare blocked this request.");
    }

    await randomDelay(300, 900);
    await page.fill("#search-word", playlistUrl);
    await randomDelay(300, 900);
    await page.click("#analyze");

    try {
      await page.waitForResponse(
        (r) => /\/v1\/playlists\/[^/]+$/.test(r.url()) && r.status() === 200,
        { timeout: 20000 }
      );
    } catch {
      throw new Error("chosic didn't return playlist data - check the link is public and valid.");
    }

    // Keep polling until every page has landed (rawItems reaches the playlist's
    // reported total) and the network's gone quiet - covers however many extra
    // /items pages and audio-features batches a >100-track playlist needs.
    const deadline = Date.now() + MAX_COLLECT_MS;
    while (Date.now() < deadline) {
      await page.waitForTimeout(POLL_INTERVAL_MS);
      const pagesComplete = expectedTotal !== undefined && rawItems.length >= expectedTotal;
      const quiet = Date.now() - lastActivityAt > QUIET_MS;
      if (pagesComplete && quiet) break;
    }

    if (expectedTotal !== undefined && rawItems.length < expectedTotal) {
      throw new Error(
        `Only collected ${rawItems.length}/${expectedTotal} tracks before timing out - chosic may still be paginating.`
      );
    }
  } finally {
    await browser.close();
  }

  if (!playlistMeta) {
    throw new Error("No playlist data captured.");
  }

  const audioFeaturesById = new Map<string, { tempo: number; key: number; mode: number }>();
  for (const batch of audioFeatureBatches) {
    for (const f of batch.audio_features ?? []) {
      if (f) audioFeaturesById.set(f.id, { tempo: f.tempo, key: f.key, mode: f.mode });
    }
  }

  const tracks: ChosicScrapedTrack[] = rawItems
    .filter((item): item is { track: SpotifyTrack } => item.track !== null && item.track.type === "track")
    .map(({ track }) => {
      const audioFeatures = audioFeaturesById.get(track.id);
      return {
        id: track.id,
        bpm: audioFeatures?.tempo ?? null,
        key: audioFeatures?.key ?? null,
        mode: audioFeatures?.mode ?? null,
        previewUrl: track.preview_url ?? null,
      };
    });

  return {
    name: playlistMeta.name,
    owner: playlistMeta.owner,
    tracks,
  };
}

export async function scrapeChosicPlaylist(playlistId: string): Promise<ChosicScrapeResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await attemptScrape(playlistId);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(jitter(BACKOFF_BASE_MS[attempt]));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
