/*
npx ts-node everything.ts
*/
// everything.ts
import fs from "fs/promises";
import path from "path";

// conversation
interface Chat {
  id: string;
  title: string;
  createTime: string;
  updateTime: string;
}

interface ChatEntry {
  id: string;
  chatId: string;
  prompt: string;
  response: string;
}

const dataDir = '/Users/tedshaffer/Documents/Projects/chatgpt-export-parser/data/';

const inputDir = path.join(dataDir, 'chatGPTExport-08-19-25-0');
const outputDir = path.join(dataDir, 'output');

let rawChats: any;

const getChatMetadata = (rawChat: any): Chat => {
  const id = rawChat.id;
  const title = rawChat.title;
  const createTime = rawChat.create_time;
  const updateTime = rawChat.update_time;
  return { id, title, createTime, updateTime };
};

function extractText(content: any): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content.parts)) return content.parts.join("\n");
  if (typeof content.text === "string") return content.text;
  try { return JSON.stringify(content); } catch { return String(content); }
}

type ExportMessage = {
  id?: string;
  author?: { role?: string };
  content?: any;
  create_time?: number;
} | undefined;


function normalizeMessages(conv: any): { id?: string; role: string; text: string; t?: number }[] {
  // Prefer newer flat messages[]
  if (Array.isArray(conv?.messages)) {
    return conv.messages.map((m: ExportMessage) => ({
      id: m?.id,
      role: m?.author?.role ?? "assistant",
      text: extractText(m?.content),
      t: m?.create_time,
    }));
  }

  // Older mapping{} graph
  if (conv?.mapping && typeof conv.mapping === "object") {
    const msgs = Object.values(conv.mapping)
      .map((n: any) => n?.message)
      .filter(Boolean)
      .map((m: any) => ({
        id: m?.id,
        role: m?.author?.role ?? "assistant",
        text: extractText(m?.content),
        t: m?.create_time,
      }));
    // Sort by time; fall back to stable order if times missing
    msgs.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
    return msgs;
  }

  return [];
}


const devNewCode = (conv: any) => {
  const msgs = normalizeMessages(conv)
    .map(m => ({ ...m, text: (m.text || "").trim() }))
    // Keep only roles we care about for pairing; you can widen this if needed
    .filter(m => ["user", "assistant"].includes(m.role) && m.text.length > 0);


  // const messages = normalizeMessages(conv);
  console.log(msgs);
}

const getChatEntry = (rawChat: any) => {

  let msgs: any[] = [];
  if (Array.isArray(rawChat.messages)) {
    msgs = rawChat.messages.map((m: any) => ({
      role: m?.author?.role ?? "assistant",
      text: extractText(m?.content),
      t: m?.create_time
    }));
  } else if (rawChat.mapping) {
    msgs = Object.values(rawChat.mapping)
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

  console.log('done');
}

(async () => {
  rawChats = JSON.parse(await fs.readFile(`${inputDir}/conversations.json`, "utf8"));

  const chats: Chat[] = [];

  for (const rawChat of rawChats) {
    const chat = getChatMetadata(rawChat);
    chats.push(chat);

    // getChatEntry(rawChat);
    devNewCode(rawChat);
  }

  console.log(chats);
})();
