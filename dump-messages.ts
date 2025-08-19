// npx ts-node ./dump-messages.ts "6833ba60-48d0-800b-b806-7d8acfbf2181"
// dump-messages.ts
import fs from "fs/promises";

function extractText(content: any): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content.parts)) return content.parts.join("\n");
  if (typeof content.text === "string") return content.text;
  try { return JSON.stringify(content); } catch { return String(content); }
}

(async () => {
  const [convId] = process.argv.slice(2);
  if (!convId) throw new Error("Usage: ts-node dump-messages.ts <conversation_id>");

  const convs = JSON.parse(await fs.readFile("/Users/tedshaffer/Downloads/4dc0ec0b960f5ff39a1aa66f9e9fec586aa01c34c4e848209f98a35283ff296a-2025-08-19-18-06-12-e01b95e4bb804d9e9b323118b06d8fae/conversations.json", "utf8"));
  const c = convs.find((x: any) => x.id === convId);
  if (!c) throw new Error("Conversation not found");

  let msgs: any[] = [];
  if (Array.isArray(c.messages)) {
    msgs = c.messages.map((m: any) => ({
      role: m?.author?.role ?? "assistant",
      text: extractText(m?.content),
      t: m?.create_time
    }));
  } else if (c.mapping) {
    msgs = Object.values(c.mapping)
      .map((n: any) => n?.message)
      .filter(Boolean)
      .map((m: any) => ({
        role: m?.author?.role ?? "assistant",
        text: extractText(m?.content),
        t: m?.create_time
      }))
      .sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  }

  for (const m of msgs) {
    console.log(`\n[${m.role}] ${m.text.slice(0, 200)}${m.text.length > 200 ? "…" : ""}`);
  }
})();