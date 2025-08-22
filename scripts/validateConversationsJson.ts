// validateConversationsJson.ts

/*
ts-node validateConversationsJson.ts
*/

import fs from 'fs';
import path from 'path';

interface ChatEntry {
  _id?: string;
  projectId: string;
  chatId: string;
  originalPrompt: string;
  promptSummary: string;
  response: string;
  created?: string | Date;
  updated?: string | Date;
}

interface Chat {
  id: string;
  title: string;
  metadata: {
    title: string;
    user: string;
    created: string | Date;
    updated: string | Date;
    exported: string | Date;
  } | null;
}

interface Project {
  id: string;
  name: string;
  chats: Chat[];
}

interface ConversationsJson {
  projects: Project[];
  chatEntries: ChatEntry[];
}

const filePath = path.resolve(__dirname, '../data/chatGPTExport-08-21-25-0/conversations-with-projects.json');

function validate() {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data: ConversationsJson = JSON.parse(raw);

  console.log(`✅ Loaded file with ${data.projects.length} projects and ${data.chatEntries.length} chat entries`);

  // Sample checks
  if (!Array.isArray(data.projects)) throw new Error('projects should be an array');
  if (!Array.isArray(data.chatEntries)) throw new Error('chatEntries should be an array');

  for (const [i, project] of data.projects.entries()) {
    if (!project.id || !project.name) {
      throw new Error(`Project at index ${i} is missing id or name`);
    }
    if (!Array.isArray(project.chats)) {
      throw new Error(`Project ${project.id} has invalid chats`);
    }
  }

  for (const [i, entry] of data.chatEntries.entries()) {
    if (!entry.projectId || !entry.chatId) {
      throw new Error(`ChatEntry at index ${i} missing projectId or chatId`);
    }
    if (typeof entry.promptSummary !== 'string') {
      throw new Error(`ChatEntry ${i} has invalid promptSummary`);
    }
    if (typeof entry.response !== 'string') {
      throw new Error(`ChatEntry ${i} has invalid response`);
    }
  }

  console.log("🎉 Validation passed. JSON matches expected schema.");
}

validate();
