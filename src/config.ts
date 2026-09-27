// Paths and tiny JSON helpers shared by every module.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "..");
export const AGENT_DIR = resolve(ROOT, process.env.PI_CODING_AGENT_DIR ?? "pi"); // Pi's own config: models, skills, extensions, AGENTS.md
export const WORKSPACE = join(ROOT, "workspace"); // the agent's cwd
export const DATA = join(ROOT, "data"); // sessions + pairing state
export const CONFIG_FILE = join(ROOT, "secclaw.json");

for (const dir of [AGENT_DIR, WORKSPACE, DATA]) mkdirSync(dir, { recursive: true });

export const readJson = <T>(file: string, fallback: T): T =>
  existsSync(file) ? { ...fallback, ...JSON.parse(readFileSync(file, "utf8")) } : fallback;

export const writeJson = (file: string, value: unknown) =>
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

export type Config = { disabledSkills: string[] };

export const readConfig = () => readJson<Config>(CONFIG_FILE, { disabledSkills: [] });
export const writeConfig = (config: Config) => writeJson(CONFIG_FILE, config);
