// Entry point: start the Pi agent and the Telegram bridge.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAgent } from "./agent.js";
import { DATA } from "./config.js";
import { ownerId, pairingCode } from "./pairing.js";
import { createBot } from "./telegram.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing. Run `npm run setup`.");

writeFileSync(join(DATA, "secclaw.pid"), String(process.pid)); // lets setup stop a running instance

const agent = await createAgent();
const bot = createBot(agent, token);

// Let skills/scripts message the owner through the Bot API (see pi/skills/notify).
process.env.SECCLAW_CHAT_ID = String(ownerId() ?? "");

const code = pairingCode();
if (code) console.log(`Not paired yet. Send this to your bot:  /pair ${code}`);

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    await bot.stop();
    agent.session.dispose();
    process.exit(0);
  });

console.log(`secclaw running — model: ${agent.session.model?.id ?? "none"}`);
await bot.start({ drop_pending_updates: true });
