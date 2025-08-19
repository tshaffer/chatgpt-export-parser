// npx ts-node ./list-by-project.ts
// // list-by-project.ts
import fs from "fs/promises";

(async () => {
  const convs = JSON.parse(await fs.readFile("/Users/tedshaffer/Downloads/4dc0ec0b960f5ff39a1aa66f9e9fec586aa01c34c4e848209f98a35283ff296a-2025-08-19-18-06-12-e01b95e4bb804d9e9b323118b06d8fae/conversations.json", "utf8"));
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
