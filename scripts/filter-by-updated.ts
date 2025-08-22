/**
 * filter-by-updated.ts
 *
 * 
  from
      /Users/tedshaffer/Documents/Projects/chatgpt-export-parser/scripts
  run
      npx ts-node filter-by-updated.ts "2025-08-19"

 * Usage:
 *   npx ts-node filter-by-updated.ts "2025-07-01"               # start only → end = now
 *   npx ts-node filter-by-updated.ts "2025-07-01" "2025-07-31"  # start + end (inclusive to end-of-day)
 *   npx ts-node filter-by-updated.ts "2025-07-01T09:30:00-07:00" "2025-07-15T17:00:00-07:00"
 *
 * Reads:
 *   <inputDir>/conversations-with-projects.json
 *
 * Writes:
 *   ./updated-<start>__<end>.json                  (flat list of matching conversations)
 *   ./updated-<start>__<end>-by-project.json       (project-level grouping/summary)
 */

import fs from "fs/promises";
import path from "path";

const dataDir = "/Users/tedshaffer/Documents/Projects/chatgpt-export-parser/data/";
const inputDir = path.join(dataDir, "chatGPTExport-08-21-25-0");

// ---- Helpers ----
function parseDateToEpochSeconds(input: string): number {
  if (!input) throw new Error("Missing date string.");
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
  return d.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
}

type Conversation = {
  id: string;
  title: string;
  create_time?: number;
  update_time?: number;
  project?: { id: string; name?: string } | null;
  messages?: unknown[];
  mapping?: unknown;
};

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
  const endSec =
    endArg ? parseDateToEpochSeconds(endArg) : Math.floor(Date.now() / 1000);

  // Read the conversations WITH injected project info
  const inputPath = path.join(inputDir, "conversations-with-projects.json");

  const convs: Conversation[] = JSON.parse(await fs.readFile(inputPath, "utf8"));

  // Filter by update_time in range
  const filtered = convs.filter((c) => {
    const u = normalizeExportEpochSeconds(c.update_time);
    if (u == null) return false;
    return u >= startSec && u <= endSec;
  });

  // Sort by most recently updated (nice to have)
  filtered.sort((a, b) => {
    const au = normalizeExportEpochSeconds(a.update_time) ?? 0;
    const bu = normalizeExportEpochSeconds(b.update_time) ?? 0;
    return bu - au;
  });

  // ---- Project-level grouping/summary ----
  type ProjectGroup = {
    id: string;
    name: string;
    conversationCount: number;
    conversations: {
      id: string;
      title: string;
      create_time?: number;
      update_time?: number;
    }[];
  };

  const groupsMap = new Map<string, ProjectGroup>();

  for (const c of filtered) {
    const pid = c.project?.id ?? "none";
    const pname = c.project?.name ?? "No Project";
    if (!groupsMap.has(pid)) {
      groupsMap.set(pid, {
        id: pid,
        name: pname,
        conversationCount: 0,
        conversations: [],
      });
    }
    const g = groupsMap.get(pid)!;
    g.conversations.push({
      id: c.id,
      title: c.title,
      create_time: c.create_time,
      update_time: c.update_time,
    });
    g.conversationCount++;
  }

  // Sort conversations inside each project by update_time desc
  for (const g of groupsMap.values()) {
    g.conversations.sort((a, b) => {
      const au = normalizeExportEpochSeconds(a.update_time) ?? 0;
      const bu = normalizeExportEpochSeconds(b.update_time) ?? 0;
      return bu - au;
    });
  }

  // Sort projects by size (desc), then name
  const projects = Array.from(groupsMap.values()).sort((a, b) => {
    if (b.conversationCount !== a.conversationCount)
      return b.conversationCount - a.conversationCount;
    return a.name.localeCompare(b.name);
  });

  // ---- Write outputs ----
  const endStamp = endArg ?? fmtForFilename(new Date());
  const base = `updated-${startArg.replace(/[:]/g, "")}__${endStamp.replace(/[:]/g, "")}`;

  const flatOut = path.join(inputDir, `${base}.json`);
  const groupedOut = path.join(inputDir, `${base}-by-project.json`);

  await fs.writeFile(flatOut, JSON.stringify(filtered, null, 2), "utf8");

  const summary = {
    exportedAt: new Date().toISOString(),
    range: { start: startSec, end: endSec },
    totals: {
      conversations: filtered.length,
      projects: projects.length,
    },
    projects,
  };
  await fs.writeFile(groupedOut, JSON.stringify(summary, null, 2), "utf8");

  console.log(
    `Exported ${filtered.length} conversations to:\n` +
      `  • ${flatOut}\n` +
      `  • ${groupedOut} (grouped by project)`
  );
})();
