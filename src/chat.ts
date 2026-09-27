// Local terminal chat with the same agent — handy for testing without Telegram.
import { createInterface } from "node:readline/promises";
import { createAgent } from "./agent.js";

const agent = await createAgent();
agent.session.subscribe((e) => {
  if (e.type === "message_update" && e.assistantMessageEvent.type === "text_delta") process.stdout.write(e.assistantMessageEvent.delta);
  if (e.type === "tool_execution_start") process.stdout.write(`\n🔧 ${e.toolName}\n`);
});

const once = process.argv.slice(2).join(" ");
if (once) {
  await agent.session.prompt(once);
  console.log();
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  for (;;) {
    const line = (await rl.question("\n> ")).trim();
    if (line === "/exit") break;
    if (line) await agent.session.prompt(line);
  }
  rl.close();
}
agent.session.dispose();
