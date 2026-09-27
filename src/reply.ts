// Runs one prompt and streams the answer into a single, periodically edited Telegram message.
import type { Context } from "grammy";
import type { Agent } from "./agent.js";

const LIMIT = 4000; // Telegram caps messages at 4096 chars
const EDIT_MS = 1500; // stay under Telegram's edit rate limit

const chunks = (text: string) => text.match(/[\s\S]{1,4000}/g) ?? ["(empty)"];

const describe = (args: any) =>
  String(args?.command ?? args?.path ?? JSON.stringify(args ?? {})).replace(/\s+/g, " ").slice(0, 80);

export async function streamReply(ctx: Context, agent: Agent, prompt: string) {
  const { chat, message_id } = await ctx.reply("…");
  const edit = (text: string) => ctx.api.editMessageText(chat.id, message_id, text).catch(() => {});

  let text = "";
  let error = "";
  let shown = "";
  const tools: string[] = [];
  const render = () => [...tools.slice(-4), text].filter(Boolean).join("\n").slice(-LIMIT) || "…";

  const off = agent.session.subscribe((e) => {
    if (e.type === "message_start") text = "";
    if (e.type === "message_update" && e.assistantMessageEvent.type === "text_delta") text += e.assistantMessageEvent.delta;
    if (e.type === "tool_execution_start") tools.push(`🔧 ${e.toolName}: ${describe(e.args)}`);
    if (e.type === "message_end" && "errorMessage" in e.message && e.message.errorMessage) error = e.message.errorMessage;
  });
  const timer = setInterval(() => {
    const next = render();
    if (next !== shown) edit((shown = next));
  }, EDIT_MS);
  const typing = setInterval(() => ctx.replyWithChatAction("typing").catch(() => {}), 4500);

  try {
    await agent.session.prompt(prompt);
  } catch (err) {
    error = (err as Error).message;
  } finally {
    clearInterval(timer);
    clearInterval(typing);
    off();
  }

  const final = error ? `⚠️ ${error}` : agent.session.getLastAssistantText() || text || "(no response)";
  const [first, ...rest] = chunks(final);
  await edit(first);
  for (const part of rest) await ctx.reply(part);
}
