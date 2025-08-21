/*
  npx ts-node everything.ts
*/
// everything.ts
import fs from "fs/promises";
import path from "path";

interface Project {
  id: string; // unique identifier
  name: string;
  chats: Chat[];
}

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

let conversations: any;
const projects = new Map<string, Project>();

const getChatMetadata = (rawChat: any): Chat => {
  const id = rawChat.id;
  const title = rawChat.title;
  const createTime = rawChat.create_time;
  const updateTime = rawChat.update_time;
  return { id, title, createTime, updateTime };
};

const addConversationToProject = (project: Project, conversation: any): void => {
  const chat = getChatMetadata(conversation);
  project.chats.push(chat);
}

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


const getChatEntries = (rawChat: any) => {

  const msgs = normalizeMessages(rawChat)
    .map(m => ({ ...m, text: (m.text || "").trim() }))
    .filter(m => ["user", "assistant"].includes(m.role) && m.text.length > 0);

  const entries: ChatEntry[] = [];
  const chatId = rawChat.id;

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];

    // Start a new entry when we encounter a user message
    if (m.role === "user") {
      // Merge consecutive user messages (rare, but can happen)
      let prompt = m.text;
      let firstUserId = m.id;
      let j = i + 1;
      while (j < msgs.length && msgs[j].role === "user") {
        prompt += "\n" + msgs[j].text;
        if (!firstUserId) firstUserId = msgs[j].id;
        j++;
      }

      // Collect assistant replies until next user (concatenate if multiple assistant chunks)
      let response = "";
      let firstAssistantId: string | undefined;
      while (j < msgs.length && msgs[j].role === "assistant") {
        if (!firstAssistantId) firstAssistantId = msgs[j].id;
        response += (response ? "\n" : "") + msgs[j].text;
        j++;
      }

      // Create an entry even if response is empty (e.g., truncated chats)
      const entryId =
        firstAssistantId || firstUserId || `${chatId}:${entries.length}`;

      entries.push({
        id: String(entryId),
        chatId,
        prompt: prompt.trim(),
        response: response.trim(),
      });

      // advance i to the last chunk we consumed
      i = j - 1;
    }
    // If an assistant message comes before any user message (edge case), skip it.
  }
}

const getProjectFromConversation = (rawChat: any): Project => {
  let project: Project;
  const projectId = rawChat.project?.id ?? "none";
  const projectName = rawChat.project?.name ?? "No Project";
  if (!projects.has(projectId)) {
    project = {
      id: projectId,
      name: projectName,
      chats: []
    };
    projects.set(projectId, project);
  } else {
    project = projects.get(projectId)!;
  }
  return project;
};

// main
(async () => {

  conversations = JSON.parse(await fs.readFile(`${inputDir}/conversations-with-projects.json`, "utf8"));

  for (const conversation of conversations) {
    const project = getProjectFromConversation(conversation);
    
    addConversationToProject(project, conversation);

    getChatEntries(conversation);
  }

  console.log(projects.size, "projects found");
  console.log(projects);
})();
