/*
npx ts-node ./dump-messages.ts "6833ba60-48d0-800b-b806-7d8acfbf2181"
npx ts-node dump-messages.ts "68a0fcd6-6128-8327-bb8b-358a849ddc70"

BUG:
fails to properly extract message content for:
"text": "Great question, Ted! 🚗 Let’s break this down based on a **4-day stay in Cozumel**:\n\n---\n\n## 🚗 **Should You Rent a Car in Cozumel?**\n\n### ✅ **Reasons to Rent a Car**\n- **Explore the Island at Your Own Pace**  \n  Cozumel is about **30 miles long and 10 miles wide**—very drivable. Renting a car lets you:\n  - Visit **wild east coast beaches** like Chen Rio and Punta Morena.\n  - Stop at **beach clubs** (Palancar, Paradise Beach, Money Bar) without relying on taxis.\n  - Drive to **Chankanaab Park** or **San Gervasio ruins**.\n  - **Snorkel at multiple spots** without booking tours.\n\n- **Taxi Costs Add Up**  \n  Taxis in Cozumel are **not metered**, and prices are **fixed by zone**. A round trip from the ferry or town to a beach club can cost **$20–40 USD** or more. If you plan to **explore more than one spot per day**, a car pays off quickly.\n\n- **Flexibility for Spontaneous Plans**  \n  Go wherever you want, whenever you want—especially helpful if you're **chasing sunsets, beach hopping**, or avoiding crowds.\n\n---\n\n### 🚫 **Reasons You Might Not Need a Car**\n- If you plan to:\n  - **Stay at a single beach resort** or **all-inclusive**.\n  - Spend most of your time **in town (San Miguel)**, walking to shops and restaurants.\n  - Book **organized tours** that include transportation (e.g., snorkeling trips, catamaran tours, submarine rides).\n\n- If you **aren’t comfortable driving in Mexico** (though Cozumel is very safe and easy to navigate compared to the mainland).\n\n---\n\n## 🛵 **Alternative: Scooter or Bike Rental**\n- **Scooter**: Popular for solo or couples who don’t need much luggage space. But roads can get windy—only if you're comfortable on a scooter.\n- **Bike**: Fun for short distances around town but **not practical for longer beach trips** (distances are too far, especially in the heat).\n\n---\n\n## 💲 **Rental Car Costs (Ballpark)**\n- **$40–60 USD per day**, plus insurance (~$15–25/day).  \n- Gas is reasonably priced—expect to use about **$10–20 USD** over 4 days unless you’re driving a lot.\n\n---\n\n## ✅ **My Recommendation for a 4-Day Stay**\n- If you want to **explore multiple beaches, visit ruins, or enjoy flexibility**: **Rent a car**.\n- If you plan to **stay mostly at a resort or book tours**: You can skip it and use taxis.\n\n---\n\nWould you like a **sample 4-day Cozumel itinerary with a car rental in mind**? Let me know! 🌴🚙🐠",

*/
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