/*
npx ts-node find-by-url-id.ts "https://chatgpt.com/c/68a4b9e6-cd54-8328-8ea8-e119cd17bfab"
npx ts-node find-by-url-id.ts "https://chatgpt.com/c/68a0fcd6-6128-8327-bb8b-358a849ddc70"
*/
// find-by-url-id.ts
import fs from "fs/promises";

(async () => {
  const conversations = JSON.parse(await fs.readFile("/Users/tedshaffer/Downloads/4dc0ec0b960f5ff39a1aa66f9e9fec586aa01c34c4e848209f98a35283ff296a-2025-08-19-18-06-12-e01b95e4bb804d9e9b323118b06d8fae/conversations.json", "utf8"));
  const url = process.argv[2]; // e.g. https://chatgpt.com/c/abc123...
  const id = url.split("/c/")[1]?.split(/[?#]/)[0];

  if (!id) throw new Error("Could not parse conversation id from URL");

  const conv = conversations.find((c: any) => c.id === id);
  if (!conv) {
    console.log("No conversation found with that id.");
    return;
  }

  console.log({
    id: conv.id,
    title: conv.title,
    project: conv.project ?? null,
    create_time: conv.create_time,
    update_time: conv.update_time,
    hasMessagesArray: Array.isArray(conv.messages),
    hasMapping: !!conv.mapping
  });
})();