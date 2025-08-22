/**
 * filter-by-updated.ts
 *
 * Usage:
 *   npx ts-node filter-by-updated.ts "2025-07-01"               # start only → end = now
 *   npx ts-node filter-by-updated.ts "2025-07-01" "2025-07-31"  # start + end (inclusive to end-of-day)
 *   npx ts-node filter-by-updated.ts "2025-07-01T09:30:00-07:00" "2025-07-15T17:00:00-07:00"
 *
 * Reads:  ./conversations.json  (same folder by default)
 * Writes: ./updated-<start>__<end>.json  (subset of conversations)
 */

import fs from "fs/promises";
import path from "path";

const dataDir = '/Users/tedshaffer/Documents/Projects/chatgpt-export-parser/data/';
const inputDir = path.join(dataDir, 'chatGPTExport-08-21-25-0');

// ---- Helpers ----
function parseDateToEpochSeconds(input: string): number {
  if (!input) throw new Error("Missing date string.");
  // If user passed a bare date like "YYYY-MM-DD" for END, make it end-of-day local
  // We’ll detect bare-date pattern:
  const isBareDate = /^\d{4}-\d{2}-\d{2}$/.test(input);
  const d = isBareDate ? new Date(input + "T23:59:59") : new Date(input);
  const t = d.getTime();
  if (Number.isNaN(t)) throw new Error(`Invalid date: ${input}`);
  return Math.floor(t / 1000);
}

// Export sometimes uses seconds, sometimes ms. Normalize to epoch seconds.
function normalizeExportEpochSeconds(x?: number): number | undefined {
  if (x == null || typeof x !== "number") return undefined;
  return x > 1e12 ? Math.floor(x / 1000) : x;
}

function fmtForFilename(d: Date): string {
  // e.g., 2025-08-21T10-45-00
  return d.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
}

(async () => {
  const [startArg, endArg] = process.argv.slice(2);
  if (!startArg) {
    console.error(
      "Usage:\n  npx ts-node filter-by-updated.ts <start> [end]\n" +
      'Examples:\n  npx ts-node filter-by-updated.ts "2025-07-01"\n' +
      '  npx ts-node filter-by-updated.ts "2025-07-01" "2025-07-31"'
    );
    process.exit(1);
  }

  const startSec = parseDateToEpochSeconds(startArg);
  const endSec = endArg ? parseDateToEpochSeconds(endArg) : Math.floor(Date.now() / 1000);

  // const file = path.resolve("conversations.json");
  // const convs = JSON.parse(await fs.readFile(file, "utf8"));
  const convs = JSON.parse(await fs.readFile(`${inputDir}/conversations.json`, "utf8"));

  const filtered = convs.filter((c: any) => {
    const u = normalizeExportEpochSeconds(c.update_time);
    if (u == null) return false;
    return u >= startSec && u <= endSec;
  });

  const outName = `updated-${startArg.replace(/[:]/g, "")}__${(endArg ?? fmtForFilename(new Date())).replace(/[:]/g, "")}.json`;
  const outPath = path.resolve(outName);
  await fs.writeFile(outPath, JSON.stringify(filtered, null, 2), "utf8");

  console.log(`Exported ${filtered.length} conversations to ${outPath}`);
})();
