/*
npx ts-node list-by-project.ts
*/
// // list-by-project.ts
import fs from "fs/promises";

const dataDir = '/Users/tedshaffer/Documents/Projects/chatgpt-export-parser/data/chatGPTExport-08-19-25-0';

(async () => {
  const convs = JSON.parse(await fs.readFile(`${dataDir}/conversations.json`, "utf8"));
  const projects = new Map<string, { name: string; convs: any[] }>();

  for (const c of convs) {
    const pid = c.project?.id ?? "none";
    const pname = c.project?.name ?? "No Project";
    if (!projects.has(pid)) projects.set(pid, { name: pname, convs: [] });
    projects.get(pid)!.convs.push(c);
  }

  for (const [pid, { name, convs: list }] of projects) {
    console.log(`\n=== ${name} (${pid}) — ${list.length} chats ===`);
    for (const c of list.sort((a, b) => (b.update_time ?? 0) - (a.update_time ?? 0))) {
      console.log(`- ${c.title}  [${c.id}]`);
    }
  }
})();
