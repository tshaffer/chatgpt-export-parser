/**
 * Usage:

npx ts-node validate-conversations-with-projects.ts ../data/chatGPTExport-08-21-25-0/conversations-with-projects.json

*   npx ts-node validate-conversations-with-projects.ts /path/to/conversations-with-projects.json
 *   # (optional cross-check)
 *   npx ts-node validate-conversations-with-projects.ts /path/to/conversations-with-projects.json /path/to/project-map.json
 *
 * What it validates:
 *  - conversations-with-projects.json is an array
 *  - Each conversation has: id (string), title (string), mapping (object), project (null | { id:string, name:string })
 *  - create_time / update_time are present (number | string)
 *  - Optional: verifies that every chat ID present in project-map.json appears in conversations-with-projects.json,
 *    and that each such conversation has the expected project name assigned.
 */

import fs from "fs/promises";
import path from "path";

type ProjectTag = { id: string; name: string } | null;

type Conversation = {
  id: string;
  title: string;
  create_time?: number | string | null;
  update_time?: number | string | null;
  mapping: Record<string, any>;
  project: ProjectTag;
  // other fields from ChatGPT export may exist; we ignore them
};

type ProjectMap = Record<string, string[]>; // { "Project Name": ["chatId1","chatId2", ...] }

function isString(x: any): x is string {
  return typeof x === "string";
}

function isObject(x: any): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function validateProjectTag(p: any): p is ProjectTag {
  if (p === null) return true;
  return isObject(p) && isString((p as any).id) && isString((p as any).name);
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    throw new Error(`Invalid JSON: ${filePath}\n${(e as Error).message}`);
  }
}

(async () => {
  const convFile = process.argv[2];
  const projectMapFile = process.argv[3]; // optional

  if (!convFile) {
    console.error("Usage: npx ts-node validate-conversations-with-projects.ts /path/to/conversations-with-projects.json [/path/to/project-map.json]");
    process.exit(1);
  }

  const absConv = path.resolve(convFile);
  const conversations = await readJson<unknown>(absConv);

  if (!Array.isArray(conversations)) {
    throw new Error(`Expected an array in ${absConv}`);
  }

  let withProject = 0;
  let withoutProject = 0;

  const idToProjectName: Record<string, string | null> = {};
  const projectCounts: Record<string, number> = {};

  conversations.forEach((c, idx) => {
    // Basic required shape
    if (!isObject(c)) {
      throw new Error(`Conversation at index ${idx} is not an object`);
    }

    const id = (c as any).id;
    const title = (c as any).title;
    const mapping = (c as any).mapping;
    const project = (c as any).project as ProjectTag;
    const create_time = (c as any).create_time;
    const update_time = (c as any).update_time;

    if (!isString(id) || !id.trim()) {
      throw new Error(`Conversation at index ${idx} has invalid/missing "id"`);
    }
    if (!isString(title)) {
      throw new Error(`Conversation ${id} has invalid/missing "title"`);
    }
    if (!isObject(mapping)) {
      throw new Error(`Conversation ${id} has invalid/missing "mapping" (expected object)`);
    }
    if (!validateProjectTag(project)) {
      throw new Error(`Conversation ${id} has invalid "project" (expected null or { id, name })`);
    }
    if (create_time !== undefined && create_time !== null && !(typeof create_time === "number" || typeof create_time === "string")) {
      throw new Error(`Conversation ${id} has invalid "create_time" (expected number|string|null)`);
    }
    if (update_time !== undefined && update_time !== null && !(typeof update_time === "number" || typeof update_time === "string")) {
      throw new Error(`Conversation ${id} has invalid "update_time" (expected number|string|null)`);
    }

    idToProjectName[id] = project ? project.name : null;
    if (project && project.name) {
      withProject++;
      projectCounts[project.name] = (projectCounts[project.name] ?? 0) + 1;
    } else {
      withoutProject++;
    }
  });

  console.log(`✅ Loaded ${conversations.length} conversations from ${absConv}`);
  console.log(`• With project: ${withProject}`);
  console.log(`• Without project: ${withoutProject}`);

  // Print top projects by count
  const sorted = Object.entries(projectCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (sorted.length) {
    console.log("\nTop projects by conversation count:");
    for (const [name, count] of sorted) {
      console.log(`  - ${name}: ${count}`);
    }
  }

  // Optional cross-check vs project-map.json
  if (projectMapFile) {
    const absMap = path.resolve(projectMapFile);
    const projectMap = await readJson<ProjectMap>(absMap);

    // Build an inverse index of conv -> expected project from project-map
    const expectedProjectById: Record<string, string> = {};
    for (const [projName, ids] of Object.entries(projectMap)) {
      if (!Array.isArray(ids)) continue;
      for (const chatId of ids) {
        if (isString(chatId)) {
          expectedProjectById[chatId] = projName;
        }
      }
    }

    // Check each expected mapping exists and matches
    const missingIds: string[] = [];
    const mismatches: Array<{ id: string; expected: string; actual: string | null }> = [];

    for (const [id, expectedProj] of Object.entries(expectedProjectById)) {
      const actualProj = idToProjectName[id] ?? null;
      if (actualProj === undefined) {
        // not found in conversations
        missingIds.push(id);
      } else if (actualProj !== expectedProj) {
        mismatches.push({ id, expected: expectedProj, actual: actualProj });
      }
    }

    if (missingIds.length) {
      console.warn(`\n⚠️  ${missingIds.length} chat ID(s) from project-map.json not present in conversations-with-projects.json`);
      console.warn(missingIds.slice(0, 20).map((x) => `  - ${x}`).join("\n") + (missingIds.length > 20 ? `\n  ...and ${missingIds.length - 20} more` : ""));
    }
    if (mismatches.length) {
      console.warn(`\n⚠️  ${mismatches.length} assignment mismatch(es) (expected project vs actual project tag):`);
      console.warn(
        mismatches
          .slice(0, 20)
          .map((m) => `  - ${m.id}: expected "${m.expected}", actual "${m.actual ?? 'null'}"`)
          .join("\n") + (mismatches.length > 20 ? `\n  ...and ${mismatches.length - 20} more` : "")
      );
    }

    if (!missingIds.length && !mismatches.length) {
      console.log("\n🔎 Cross-check vs project-map.json PASSED.");
    } else {
      console.log("\n🔎 Cross-check vs project-map.json completed with warnings (see above).");
    }
  }

  console.log("\n🎉 Validation passed.");
})().catch((err) => {
  console.error(`\n❌ Validation failed: ${(err as Error).message}`);
  process.exit(1);
});
