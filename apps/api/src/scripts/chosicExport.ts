/**
 * Manual dev tool: run a Spotify playlist through the chosic scraper service
 * and write the resulting bpm/key data to a local JSON file, for ad-hoc
 * debugging outside of the app's own permanent cache (see routes/trackData.ts
 * for the HTTP-triggered, DB-persisted equivalent).
 *
 * Usage: npm run chosic:export -- <spotify-playlist-url-or-id>
 * First run: npx playwright install chromium
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { scrapeChosicPlaylist } from "../services/chosicScraper";

function extractPlaylistId(input: string): string {
  const match = input.match(/playlist[/:]([a-zA-Z0-9]+)/);
  return match ? match[1] : input;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run chosic:export -- <spotify-playlist-url-or-id>");
    process.exit(1);
  }
  const playlistId = extractPlaylistId(arg);

  console.log(`Scraping chosic exporter for playlist ${playlistId} ...`);
  const { name, owner, tracks } = await scrapeChosicPlaylist(playlistId);

  if (tracks.length === 0) {
    console.warn("Warning: no tracks captured.");
  }

  const output = { playlistId, name, owner, trackCount: tracks.length, tracks };

  const outDir = path.join(__dirname, "..", "..", "output");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${playlistId}.json`);
  await writeFile(outPath, JSON.stringify(output, null, 2));

  console.log(`Wrote ${tracks.length} tracks to ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
