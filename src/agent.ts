// One persistent Pi session. Pi owns tools, models, skills, extensions and history.
import { join } from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  resolveModelScopeWithDiagnostics,
  SessionManager,
  type AgentSession,
  type Skill,
} from "@earendil-works/pi-coding-agent";
import { AGENT_DIR, DATA, readConfig, readJson, WORKSPACE } from "./config.js";

const SESSIONS = join(DATA, "sessions");

type Settings = { defaultProvider?: string; defaultModel?: string; enabledModels?: string[] };
type ModelsFile = { providers: Record<string, { models?: { id: string }[] }> };

// Configured models: Pi's `enabledModels`, the default model, and everything in models.json.
function modelPatterns() {
  const settings = readJson<Settings>(join(AGENT_DIR, "settings.json"), {});
  const { providers } = readJson<ModelsFile>(join(AGENT_DIR, "models.json"), { providers: {} });
  const custom = Object.entries(providers).flatMap(([p, { models = [] }]) => models.map((m) => `${p}/${m.id}`));
  const fallback = settings.defaultProvider && settings.defaultModel ? [`${settings.defaultProvider}/${settings.defaultModel}`] : [];
  return [...new Set([...(settings.enabledModels ?? []), ...fallback, ...custom])];
}

export type Agent = Awaited<ReturnType<typeof createAgent>>;

export async function createAgent() {
  const models = await ModelRuntime.create({
    authPath: join(AGENT_DIR, "auth.json"),
    modelsPath: join(AGENT_DIR, "models.json"),
  });

  let skills: Skill[] = []; // everything Pi discovered, before filtering
  const loader = new DefaultResourceLoader({
    cwd: WORKSPACE,
    agentDir: AGENT_DIR,
    skillsOverride: (found) => {
      skills = found.skills;
      const { disabledSkills } = readConfig();
      return { ...found, skills: found.skills.filter((s) => !disabledSkills.includes(s.name)) };
    },
  });

  let session!: AgentSession;
  async function open(manager = SessionManager.continueRecent(WORKSPACE, SESSIONS)) {
    session?.dispose();
    await loader.reload();
    ({ session } = await createAgentSession({
      cwd: WORKSPACE,
      agentDir: AGENT_DIR,
      modelRuntime: models,
      resourceLoader: loader,
      sessionManager: manager,
    }));
  }
  await open();

  return {
    models,
    get session() {
      return session;
    },
    get skills() {
      return skills;
    },
    // Models the user configured (not the whole provider catalog) that Pi has credentials for.
    listModels: async () => (await resolveModelScopeWithDiagnostics(modelPatterns(), models)).scopedModels.map((s) => s.model),
    reload: () => open(), // same conversation, fresh resources
    reset: () => open(SessionManager.create(WORKSPACE, SESSIONS)), // new conversation
  };
}
