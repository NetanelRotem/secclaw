// Single-owner pairing: the first Telegram user to send the one-time code owns the bot.
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { DATA, readJson, writeJson } from "./config.js";

const FILE = join(DATA, "pairing.json");
type State = { owner?: number; code?: string };

const load = () => readJson<State>(FILE, {});

export const ownerId = () => load().owner;

// Returns the pending pairing code, creating one if needed.
export function pairingCode() {
  const state = load();
  if (state.owner) return undefined;
  if (!state.code) writeJson(FILE, { code: (state.code = randomBytes(4).toString("hex").toUpperCase()) });
  return state.code;
}

export function pair(userId: number, code: string) {
  const expected = pairingCode();
  if (!expected || code.trim().toUpperCase() !== expected) return false;
  writeJson(FILE, { owner: userId });
  process.env.SECCLAW_CHAT_ID = String(userId);
  return true;
}
