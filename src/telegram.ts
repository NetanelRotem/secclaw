// Telegram bridge: pairing guard, a handful of commands, everything else goes to Pi.
import { Bot, InlineKeyboard, type Context } from "grammy";
import type { Agent } from "./agent.js";
import { readConfig, writeConfig } from "./config.js";
import { ownerId, pair } from "./pairing.js";
import { streamReply } from "./reply.js";

const COMMANDS = [
  { command: "new", description: "Start a new conversation" },
  { command: "stop", description: "Abort the current run" },
  { command: "model", description: "Switch model" },
  { command: "skills", description: "Enable / disable skills" },
  { command: "reload", description: "Reload skills, extensions and AGENTS.md" },
  { command: "status", description: "Show model, session and skills" },
];

export function createBot(agent: Agent, token: string) {
  const bot = new Bot(token);
  // Runs are not awaited by handlers: grammY handles updates one by one, so awaiting would block /stop.
  let running: Promise<void> | undefined;
  const busy = async (ctx: Context) => !!running && !!(await ctx.reply("Busy — /stop first."));

  bot.command("pair", async (ctx) => {
    const ok = pair(ctx.from!.id, ctx.match);
    await ctx.reply(ok ? "✅ Paired. This bot is now yours." : "❌ Invalid code.");
  });

  // Everyone except the owner is silently ignored.
  bot.use((ctx, next) => (ctx.from?.id === ownerId() ? next() : undefined));

  bot.command("start", (ctx) => ctx.reply("Hi! Just talk to me."));

  bot.command("new", async (ctx) => {
    if (await busy(ctx)) return;
    await agent.reset();
    await ctx.reply("🆕 New conversation.");
  });

  bot.command("reload", async (ctx) => {
    if (await busy(ctx)) return;
    await agent.reload();
    await ctx.reply(`🔄 Reloaded. ${agent.skills.length} skills found.`);
  });

  bot.command("stop", async (ctx) => {
    if (!running) return ctx.reply("Nothing is running.");
    await ctx.reply("⏹ Stopping…");
    agent.session.abort().catch(() => {});
  });

  bot.command("status", (ctx) => {
    const { model, sessionFile } = agent.session;
    const { disabledSkills } = readConfig();
    const skills = agent.skills.map((s) => s.name).filter((n) => !disabledSkills.includes(n));
    return ctx.reply(
      `Model: ${model ? `${model.provider}/${model.id}` : "none"}\n` +
        `Messages: ${agent.session.messages.length}\n` +
        `Session: ${sessionFile ?? "in-memory"}\n` +
        `Skills: ${skills.join(", ") || "none"}`,
    );
  });

  // Skills: toggle buttons backed by secclaw.json.
  const skillsKeyboard = () => {
    const { disabledSkills } = readConfig();
    const kb = new InlineKeyboard();
    agent.skills.forEach((s, i) => kb.text(`${disabledSkills.includes(s.name) ? "⬜" : "✅"} ${s.name}`, `skill:${i}`).row());
    return kb;
  };

  bot.command("skills", (ctx) =>
    agent.skills.length
      ? ctx.reply("Skills (tap to toggle):", { reply_markup: skillsKeyboard() })
      : ctx.reply("No skills found. Add folders with a SKILL.md to pi/skills/."),
  );

  bot.callbackQuery(/^skill:(\d+)$/, async (ctx) => {
    const skill = agent.skills[Number(ctx.match[1])];
    if (!skill || running) return ctx.answerCallbackQuery("Busy or unknown skill");
    const config = readConfig();
    const off = config.disabledSkills.includes(skill.name);
    config.disabledSkills = off ? config.disabledSkills.filter((n) => n !== skill.name) : [...config.disabledSkills, skill.name];
    writeConfig(config);
    await agent.reload();
    await ctx.answerCallbackQuery(`${skill.name} ${off ? "enabled" : "disabled"}`);
    await ctx.editMessageReplyMarkup({ reply_markup: skillsKeyboard() });
  });

  // Models: the ones configured in pi/ (see agent.listModels).
  bot.command("model", async (ctx) => {
    const models = await agent.listModels();
    if (!models.length) return ctx.reply("No models available. Run `npm run setup` or edit pi/models.json.");
    const current = agent.session.model;
    const kb = new InlineKeyboard();
    models.slice(0, 40).forEach((m, i) => {
      const mark = m.provider === current?.provider && m.id === current?.id ? "● " : "";
      kb.text(`${mark}${m.provider}/${m.id}`, `model:${i}`).row();
    });
    await ctx.reply("Choose a model:", { reply_markup: kb });
  });

  bot.callbackQuery(/^model:(\d+)$/, async (ctx) => {
    const model = (await agent.listModels())[Number(ctx.match[1])];
    if (!model || running) return ctx.answerCallbackQuery("Busy or unknown model");
    await agent.session.setModel(model, { persist: true });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`Model: ${model.provider}/${model.id}`);
  });

  // Anything else (including Pi's /skill:name commands) is a prompt.
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (running) {
      await agent.session.steer(text);
      return ctx.reply("↪️ Added to the current run.");
    }
    running = streamReply(ctx, agent, text)
      .catch((err) => void ctx.reply(`⚠️ ${err.message}`).catch(() => {}))
      .finally(() => (running = undefined));
  });

  bot.catch((err) => console.error("telegram:", err.message));
  bot.api.setMyCommands(COMMANDS).catch(() => {});
  return bot;
}
