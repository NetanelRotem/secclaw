// Interactive setup: writes .env, Pi's settings/models, picks skills, optionally installs a background service.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseEnv } from "node:util";
import { createAgent } from "./agent.js";
import { AGENT_DIR, readConfig, readJson, ROOT, writeConfig, writeJson } from "./config.js";
import { pairingCode } from "./pairing.js";
import { installService } from "./service.js";

const ENV_FILE = join(ROOT, ".env");
const SETTINGS_FILE = join(AGENT_DIR, "settings.json");
const MODELS_FILE = join(AGENT_DIR, "models.json");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (question: string, fallback = "") =>
  (await rl.question(fallback ? `${question} [${fallback}]: ` : `${question}: `)).trim() || fallback;

const env = (existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, "utf8")) : {}) as Record<string, string>;
const saveEnv = () => writeFileSync(ENV_FILE, Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { mode: 0o600 });
const settings = readJson<Record<string, unknown>>(SETTINGS_FILE, {});

console.log("\nsecclaw setup — press Enter to keep the [default]\n");

// 1. Telegram
env.PI_CODING_AGENT_DIR ??= "./pi"; // lets `npm run pi` use this project's Pi config
env.TELEGRAM_BOT_TOKEN = await ask("Telegram bot token (create a bot with @BotFather)", env.TELEGRAM_BOT_TOKEN);

// 2. Model provider (stored in Pi's own config files)
env.ABLITERATION_API_KEY = await ask("Abliteration API key (optional, see pi/models.json)", env.ABLITERATION_API_KEY);
const provider = await ask("Default provider: 1) OpenRouter  2) OpenAI-compatible endpoint  3) skip (configure pi/ yourself)", "1");
if (provider === "1") {
  env.OPENROUTER_API_KEY = await ask("OpenRouter API key", env.OPENROUTER_API_KEY);
  const current = settings.defaultProvider === "openrouter" ? String(settings.defaultModel) : "z-ai/glm-5.3-flash";
  const model = await ask("Model id", current);
  const enabledModels = [...new Set([...((settings.enabledModels as string[]) ?? []), `openrouter/${model}`])];
  Object.assign(settings, { defaultProvider: "openrouter", defaultModel: model, enabledModels });
} else if (provider === "2") {
  const name = await ask("Provider name", "local");
  const baseUrl = await ask("Base URL", "http://localhost:11434/v1");
  const keyVar = `${name.toUpperCase().replace(/\W/g, "_")}_API_KEY`;
  env[keyVar] = await ask("API key (any text if not needed)", env[keyVar] ?? "none");
  const model = await ask("Model id");
  const models = readJson<{ providers: Record<string, unknown> }>(MODELS_FILE, { providers: {} });
  models.providers[name] = { baseUrl, api: "openai-completions", apiKey: `$${keyVar}`, models: [{ id: model }] };
  writeJson(MODELS_FILE, models);
  Object.assign(settings, { defaultProvider: name, defaultModel: model });
}
writeJson(SETTINGS_FILE, settings);
saveEnv();
Object.assign(process.env, env); // so Pi can resolve keys while we list skills

// 3. Skills
const agent = await createAgent();
const names = agent.skills.map((s) => s.name);
agent.session.dispose();
if (names.length) {
  const config = readConfig();
  const enabled = names.filter((n) => !config.disabledSkills.includes(n));
  console.log(`\nSkills found in pi/skills: ${names.join(", ")}`);
  const answer = await ask("Enabled skills (comma-separated, 'all' or 'none')", enabled.join(",") || "none");
  const keep = answer === "all" ? names : answer.split(",").map((s) => s.trim());
  writeConfig({ ...config, disabledSkills: names.filter((n) => !keep.includes(n)) });
}

// 4. Background service
const bg = await ask("\nRun in the background and start automatically on boot/login?", "Y");
console.log("\n" + (bg.toLowerCase().startsWith("y") ? installService() : "Start the bot with: npm start"));

rl.close();
const code = pairingCode();
console.log(code ? `\n👉 Send this to your bot in Telegram:  /pair ${code}\n` : "\nAlready paired. (npm run unpair to reset)\n");
