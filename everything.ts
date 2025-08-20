/*
npx ts-node everything.ts
*/
// everything.ts
import fs from "fs/promises";
import path from "path";

interface Chat {
  id: string;
  title: string;
  createTime: string;
  updateTime: string;
}

const dataDir = '/Users/tedshaffer/Documents/Projects/chatgpt-export-parser/data/';

const inputDir = path.join(dataDir, 'chatGPTExport-08-19-25-0');
const outputDir = path.join(dataDir, 'output');

(async () => {
  const rawChats = JSON.parse(await fs.readFile(`${inputDir}/conversations.json`, "utf8"));

  const chats: Chat[] = [];

  for (const rawChat of rawChats) {
    const id = rawChat.id;
    const title = rawChat.title;
    const createTime = rawChat.create_time;
    const updateTime = rawChat.update_time;

    const chat: Chat = { id, title, createTime, updateTime };
    chats.push(chat);
  }

  console.log(chats);
})();
