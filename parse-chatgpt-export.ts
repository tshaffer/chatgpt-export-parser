// npx ts-node parse-chatgpt-export.ts /Users/tedshaffer/Downloads/4dc0ec0b960f5ff39a1aa66f9e9fec586aa01c34c4e848209f98a35283ff296a-2025-08-19-18-06-12-e01b95e4bb804d9e9b323118b06d8fae ./structured-chatgpt.json

// parse-chatgpt-export.ts
import fs from "fs/promises";
import path from "path";

type AuthorRole = "user" | "assistant" | "system" | "tool" | string;

type ExportMessage =
  | {
      id?: string;
      author?: { role?: AuthorRole };
      content?: any; // varies: { parts?: string[] } or string or rich object
      create_time?: number; // unix seconds
    }
  | undefined;

type ExportNode = {
  id: string;
  message?: ExportMessage;
  parent?: string | null;
  children?: string[];
};

type ExportConversation = {
  id: string;
  title: string;
  create_time?: number;
  update_time?: number;
  // Older exports:
  mapping?: Record<string, ExportNode>;
  // Newer exports:
  messages?: ExportMessage[];
  // UI "Projects" (may be absent in older exports):
  project?: { id: string; name?: string } | null;
  // Some exports include a "model_slug" or similar; we ignore it here.
};

type NormalizedMessage = {
  id?: string;
  role: AuthorRole;
  text: string;
  createTime?: string;
};

type NormalizedConversation = {
  id: string;
  title: string;
  createTime?: string;
  updateTime?: string;
  messageCount: number;
  messages: NormalizedMessage[];
};

type NormalizedProject = {
  id: string;
  name: string;
  conversations: NormalizedConversation[];
};

type Output = {
  exportedAt: string;
  totals: { projects: number; conversations: number; messages: number };
  projects: NormalizedProject[];
};

function toIsoTime(sec?: number): string | undefined {
  if (!sec || typeof sec !== "number") return undefined;
  // Some exports have seconds, others ms; detect naive seconds and convert.
  const ms = sec > 1e12 ? sec : sec * 1000;
  return new Date(ms).toISOString();
}

function extractText(content: any): string {
  // Common cases:
  // 1) { parts: [ "...", ... ] }
  // 2) plain string
  // 3) { content_type: "code" | "image" | ... } (rare in exports)
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content?.parts)) {
    return content.parts.filter((p: any) => typeof p === "string").join("\n");
  }
  // Fallback: try common fields
  if (typeof content?.text === "string") return content.text;
  // Last resort: JSON string
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function normalizeFromMessagesArray(messages?: ExportMessage[]): NormalizedMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.map((m) => ({
    id: m?.id,
    role: (m?.author?.role ?? "assistant") as AuthorRole,
    text: extractText(m?.content),
    createTime: toIsoTime(m?.create_time),
  }));
}

function normalizeFromMapping(mapping?: Record<string, ExportNode>): NormalizedMessage[] {
  if (!mapping) return [];

  // The "mapping" is a graph; we collect all message nodes and sort by create_time
  const msgs: NormalizedMessage[] = [];
  for (const node of Object.values(mapping)) {
    if (!node?.message) continue;
    const m = node.message;
    const role: AuthorRole = (m?.author?.role ?? "assistant") as AuthorRole;
    const text = extractText(m?.content);
    if (text === "" && !m?.id) continue; // skip empties that are structure-only

    msgs.push({
      id: m?.id,
      role,
      text,
      createTime: toIsoTime(m?.create_time),
    });
  }
  // Sort by time, but keep stable order if times are missing
  msgs.sort((a, b) => {
    const at = a.createTime ? Date.parse(a.createTime) : 0;
    const bt = b.createTime ? Date.parse(b.createTime) : 0;
    return at - bt;
  });
  return msgs;
}

async function main() {
  const exportDir = process.argv[2] ?? ".";
  const outFile = process.argv[3] ?? "./structured-chatgpt.json";
  const conversationsPath = path.join(exportDir, "conversations.json");

  // Read and parse the export
  const raw = await fs.readFile(conversationsPath, "utf8");
  const conversations: ExportConversation[] = JSON.parse(raw);

  // Group by UI project (when present)
  const byProject = new Map<string, { name: string; convs: ExportConversation[] }>();
  for (const c of conversations) {
    const key = c.project?.id ?? "none";
    const name = c.project?.name ?? "No Project";
    if (!byProject.has(key)) byProject.set(key, { name, convs: [] });
    byProject.get(key)!.convs.push(c);
  }

  const projects: NormalizedProject[] = [];
  let totalMessages = 0;

  for (const [projectId, { name, convs }] of byProject) {
    const normConvs: NormalizedConversation[] = convs
      .map((c) => {
        // Prefer newer flat messages; fall back to mapping
        const msgs =
          (Array.isArray(c.messages) && c.messages.length > 0
            ? normalizeFromMessagesArray(c.messages)
            : normalizeFromMapping(c.mapping)) ?? [];

        totalMessages += msgs.length;

        return {
          id: c.id,
          title: c.title,
          createTime: toIsoTime(c.create_time),
          updateTime: toIsoTime(c.update_time),
          messageCount: msgs.length,
          messages: msgs,
        };
      })
      // Sort conversations by most recently updated (fallback: created)
      .sort((a, b) => {
        const at = Date.parse(a.updateTime ?? a.createTime ?? "1970-01-01");
        const bt = Date.parse(b.updateTime ?? b.createTime ?? "1970-01-01");
        return bt - at;
      });

    projects.push({ id: projectId, name, conversations: normConvs });
  }

  // Sort projects: named first alphabetically, then "No Project"
  projects.sort((a, b) => {
    if (a.id === "none" && b.id !== "none") return 1;
    if (b.id === "none" && a.id !== "none") return -1;
    return a.name.localeCompare(b.name);
  });

  const output: Output = {
    exportedAt: new Date().toISOString(),
    totals: {
      projects: projects.length,
      conversations: conversations.length,
      messages: totalMessages,
    },
    projects,
  };

  await fs.writeFile(outFile, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote ${outFile}`);
  console.log(
    `Projects: ${output.totals.projects} | Conversations: ${output.totals.conversations} | Messages: ${output.totals.messages}`
  );
}

main().catch((err) => {
  console.error("Failed to parse export:", err);
  process.exit(1);
});
